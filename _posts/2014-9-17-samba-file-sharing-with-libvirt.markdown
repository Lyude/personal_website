---
title: Windows guest file sharing using libvirt
description: "A tutorial for setting up libvirt to launch an unprivileged Samba server for Windows guests"
categories: [ "programming" ]
layout: post
---
For running virtual machines, my tool of choice is always virt-manager. libvirt is a very powerful and customizable frontend to various hypervisors such as qemu and Xen. Usually I use it exclusively with qemu. However, qemu does have some serious drawbacks. When it comes to it's Filesystem passthrough feature, it only works with Linux guests due to it's usage of the plan9 network filesystem. qemu actually has the ability to launch a samba server that's only locally accessible to a domain and hosts a user specified directory from the host machine, but unfortunately it requires that you use usermode networking for it. It is also not easily configurable via libvirt, since there is nothing in the API to handle it. So I decided to go on my own, and figure out how to setup a samba server with a similar setup to the one that comes with qemu by default without being limited to usermode networking.

This is where libvirt's script hooks come in handy. [libvirt has four hooks](http://www.libvirt.org/hooks.html#names) that can be used to start scripts when virtual machines start, stop, etc. The one we're concerned about here is the hook for when qemu guests start or stopped, the `qemu` hook. Using this hook, we can write a script that instructs libvirt to start a samba server whenever I boot up my Windows guest. Here's the script I've written for mine, along with the configuration I use for the samba server. it can easily be configured for you machine by changing the variables at the top.

{% highlight sh %}
#!/bin/sh

GUEST_NAME=Windows
SAMBA_USER=lyudess
SAMBA_GROUP=lyudess
SAMBA_CONF=/home/lyudess/VirtualMachines/windows.smb.conf
SAMBA_IP=192.168.122.4

if [ $1 = $GUEST_NAME ]; then
	if [ $2 = "start" ]; then
		ip addr add $SAMBA_IP/24 dev virbr0
		iptables -t nat -A PREROUTING -i virbr0 -p tcp --dest $SAMBA_IP --dport microsoft-ds -j REDIRECT --to-port 49600
		mkdir /tmp/samba
		chown $SAMBA_USER:$SAMBA_GROUP /tmp/samba
		systemd-run --uid=$SAMBA_USER --gid=$SAMBA_GROUP --unit="qemu-$GUEST_NAME-smbd" smbd -F -S -s $SAMBA_CONF
	elif [ $2 = "stopped" ]; then
		ip addr del $SAMBA_IP/24 dev virbr0
		iptables -t nat -D PREROUTING -i virbr0 --dest $SAMBA_IP --dest-port microsoft-ds -j REDIRECT --to-port 49600
		systemctl stop "qemu-$GUEST_NAME-smbd"
		rm -rf /tmp/samba
	fi
fi
{% endhighlight %}

The samba config you see mentioned in the script is as follows:
{% highlight ini %}
[global]
workgroup = MYGROUP
server string = qemu server
; This needs to be set if you don't want to use passwords
security = share
; Only listen on virbr0, the virtual network interface my Windows guest
; uses, and listen on the IP 192.168.122.4
interfaces = virbr0 192.168.122.4
bind interfaces only = yes
syslog = no
; Samba needs directories to save things too, we're not using this long
; term though so we just save everything into /tmp/samba
lock directory = /tmp/samba
state directory = /tmp/samba
cache directory = /tmp/samba
pid directory = /tmp/samba
private dir = /tmp/samba
ncalrpc dir = /tmp/samba
; Since the samba server is only visible to the windows guest, we don't
; need to bother with passwords
guest account = lyudess
guest only = yes
guest ok = yes
smb ports = 49600

[qemu]
path = "/home/lyudess/"
browseable = yes
writable = yes
{% endhighlight %}

So let's go through what this script actually does. First off, we setup an IP for the samba server to run on:
{% highlight sh %}
ip addr add $SAMBA_IP/24 dev virbr0
{% endhighlight %}
This allows the samba server to be able to listen for connections to this IP address on the virtual network adaptor, giving the guest the impression that the samba server has it's own IP. This is also useful in the event that we have an actual samba server running on the host that we want to be able to access at the same time. This is the same behavior that the built-in qemu samba server has.

Next we forward any requests to `$SAMBA_IP` from `virbr0` on the default samba port (`microsoft-ds`) to port `49600` on the host:
{% highlight sh %}
iptables -t nat -D PREROUTING -i virbr0 --dest $SAMBA_IP --dest-port microsoft-ds -j REDIRECT --to-port 49600
{% endhighlight %}
This is necessary because unfortunately, Windows can't use anything but the default Samba port when trying to access a share. But because the default port used for Samba shares is a privileged port, we can't have our Samba server running on it without having root privileges.

Now we want to make a temporary directory for samba to store all of it's databases in. As far as I know, Samba always needs some sort of directory to store these in or it will refuse to start.
{% highlight sh %}
mkdir /tmp/samba
chown $SAMBA_USER:$SAMBA_GROUP /tmp/samba
{% endhighlight %}

Then we create a systemd unit for the samba server. If you don't happen to be using systemd, you'll want to figure out your own way here of keeping track of the samba process so that you can bring it down once the virtual machine shuts down:
{% highlight sh %}
systemd-run --uid=$SAMBA_USER --gid=$SAMBA_GROUP --unit="qemu-$GUEST_NAME-smbd" smbd -F -S -s $SAMBA_CONF
{% endhighlight %}

The second half of the script is pretty self explanatory, just undo everything we did to start the server for the virtual machine and clean up after outselves. Now, just save the script as `/etc/libvirt/hooks/qemu` (if `/etc/libvirt/hooks` doesn't exist, just create the directory yourself), and mark it as executable with:
{% highlight sh %}
chmod +x /etc/libvirt/hooks/qemu
{% endhighlight %}
Boot up your machine, and you should be able to access the samba share by going to `\\192.168.122.4\qemu` in Windows explorer. Remember, the configuration I have here **does not** use a password and is not secure for serious deployments, and is only meant to be visible to my Windows guest. If you require a password, you will most likely have to run the samba instance as root and setup your own authentication system, in which case the iptables `REDIRECT` rule will not be needed since you can just run on the default privileged samba port.
