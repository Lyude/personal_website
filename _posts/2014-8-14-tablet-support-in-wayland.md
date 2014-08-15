---
title: Adding Drawing Tablet Support in Wayland
description: "A rundown of my work during the Google Summer of Code in 2014 on adding drawing tablet support to the Wayland protocol"
categories: [ "programming" ]
layout: post
---

What needed to be done
======================

When starting my Google Summer of Code project to implement tablet support in
Wayland, tablet support in the protocol was literally nonexistent. Various
proposals and drafts were made, but none of them had resulted in any code or
implementation. To get an idea of the sort of work that was needed for adding
tablet support for Wayland, you need to at least have a basic understanding of
how input with Wayland compositors works.

<img src="/resources/blog/wayland_wacom_diagram.svg"/>

It goes like this: first, the kernel receives data from the tablet. This data
contains the status of the tablet. This includes the state of all of the
buttons, the position of the tool, whether or not the tool is in proximity, and
the values of all the axes that the tablet supports; distance, pressure, etc.
Every time the kernel receives this data, it checks if anything has changed
since the last update we received from the tablet. If something has changed,
the kernel then reports it using the evdev interface. Let's say that we have a
very basic tablet device, and we move it from 10, 10 on it's coordinate grid to
100, 100. We'd receive a packet that looks something like this:

```
Event: time 1408066625.077063, type 3 (EV_ABS), code 0 (ABS_X), value 100
Event: time 1408066625.077063, type 3 (EV_ABS), code 1 (ABS_Y), value 100
Event: time 1408066625.077063, -------------- SYN_REPORT ------------
```

Every event from evdev has a type, a code, and a value. The type specifies
whether the event is a relative axis like the X and Y on an ordinary mouse
cursor, an absolute axis like the X and Y coordinates of a finger touching a
touch screen, a key event like a keyboard key or a button, or a miscellaneous
event like the serial number of a tablet tool, or an `EV_SYN` event. The
`SYN_REPORT` you see in the example above is an `EV_SYN` event. These mark
the changes of all of the updates we received from the tablet. The next part is
the code. This represents which axis, key, button, etc. updated. Then comes the
value, which is the current value/state of the of the key, button, or axis,
etc.

A program then can read the input events from the character device, which would
be `/dev/input/event_X_`. This is where libevdev comes in. libevdev is rather
simple, it provides higher level calls for working with evdev devices. From
there, we get to libinput. Libinput is a library with the purpose of making it
easy for Wayland compositors to work with input devices. It handles all of the
calls to libevdev, along with any coordinate transformation or normalization.
This helps us by saving compositors from having to reinvent the wheel and come
up with their own code to work with input devices using libevdev.

From here, the compositor uses libinput to monitor the input devices, in this
case a tablet, and handles sending the events to each of the Wayland clients.
When my project started, libinput had no official support for tablets. The
closest thing we had were a set of patches that had been sent in by one of the
GNOME developers, Carlos Garnacho, for adding tablet support to libinput, which
was actually sent in unexpectedly the same day that I was accepted into the
GSoC.

Carlos's patches helped get a lot of the initial groundwork for tablet support
done, but there was still a lot of work that had to be done. The beginning of
my development work started with cleaning up the patches, making sure they
adhered to the coding style that the rest of libinput uses. Along with this
however, I also had to learn how libinput worked, and how it interacted with
libevdev and the kernel. Although I got out a few small patches for libinput in
the first two weeks, mostly style changes and other small things that didn't
require a very good understanding of how everything worked, I spent a huge
amount of time going through the libinput source code, asking questions, and
trying to figure out how everything worked. Out of all of the parts of the
project I worked with, having to learn how everything worked together was
probably one of the most difficult parts. Although I had dabbled with some of
the input code used on Linux in the past, specifically the xf86-input-synaptics
driver, that was nothing compared to the amount I had to comprehend in order to
be able to work proficiently on libinput.

Luckily, libinput has a very clean, small, and simple codebase. It's API is
well documented, and for the most part the code adheres to a very consistent
style.  My mentor was a great help too, and provided me with documentation that
helped in giving me a better understanding of how everything worked and fit
together.  After I came to have a relatively good understanding of how libinput
worked, my next step was to look at how Carlos designed his patches, and figure
out what should be changed and what needed to be fixed.

Carlo's original design was very similar to how many other operating systems
presently handle tablet devices. Everything was an extension of the pointer.
Tool movement was analogous to moving the mouse cursor, and was multiplexed
through the same interface. Pressure, distance, and tilt were added in as extra
axes to the cursor device, and tool updates/changes were reported as normal
pointer events. This is one of the points that was debated the most; whether or
not the tablet should be treated as just another pointer device. In many
respects, a tablet is very similar to a pointing device. With any drawing
tablet, you hover over the object you want to select, and then click it, the
only difference being that sometimes instead of a button press, you tap the
cursor to the tablet's surface. As such, it can make a lot of sense to have the
two be similar devices, and seems like a good design overall. We decided to
move away from this design however, due to the problems that could very well
ensue.

First off, having everything pushed through an existing interface means that we
have to figure out how to make all of the features of a tablet work in a way
that works with a pointing device. In terms of pointing and clicking, the way
they are handled with a tablet and a cursor is basically the same. This isn't
always the case with many of the other features of a tablet. Tablets give out a
lot more information then a normal mouse does, and there are situations with
tablet devices that require us to account for things we never have to account
for with a normal mouse. For example; with a mouse we just have a cursor that
moves around the screen. The cursor is always there, and when the mouse stops
moving the cursor stays in it's place. This isn't the case with a tablet tool
though. Tablet tools can come in and out of proximity. When the tablet tool
isn't in detectable proximity of the tablet, a user expects the tool to
disappear from view on the system.

Almost every other operating system already does this by overriding the mouse
cursor and simply hiding it when it goes out of proximity, and maybe sending
some sort of proximity out signal to the client that the cursor disappeared
over. So even though each interface is different, they can still be run through
the same interface with a couple of workarounds. This is where the real
problems start, and why we choose to represent tablet objects through a
different interface. As we've learned with projects like the X server, it's
always better to fix something then work around it. Pushing everything through
the pointer interface has the potential to be hard to maintain in the future,
especially if there end up being major advancements in drawing tablets later
that make their behavior substantially different then what we have now. This
approach does has the disadvantage of requiring clients to have code to handle
both tablet devices and normal pointing devices, but in situations where a
tablet has the same basic functionalities as a pointing device does, the code
for handling pointing devices can usually just be modified slightly and reused
for handling tablet devices so the increase in the amount of work that has to
be done by the client isn't major. In addition, touch devices in Wayland were
already handled separately from the pointer, so this helps maintain consistency
in the protocol.  Because of this, we decided to change Carlos's patches to
send tablet events through their own interface, instead of sending them through
the same interface as the cursor.

This was the first major segment of coding I did for my project. Writing an API
on it's own is difficult, but working with someone else's patches and figuring
out the intention behind code that no one but the author has worked with before
poses far more challenges then starting a new project on your own does. It was
difficult and I spent hours on it, but it eventually got done and Carlos's
patches had been cleaned up and modified to our liking. After that, I went
through the review process with Peter, going through countless styling fixes
and refactoring to make the code match the rest of the codebase. In the process
I learned a lot about keeping code organized and easy to read for others, one
of the few things in computer science you need real experience to learn. Not
all projects have these kind of rigorous review policies, so in that aspect I'm
glad I choose to work with the X.Org Foundation.

After that came time to write up the actual Wayland protocol. A while back
Peter had posted a proposal on the Wayland mailing list with a possible draft
for a tablet protocol, which meant that I didn't have to start entirely from
scratch.  Peter had me write out a high-level version of the draft to begin
with instead of making it up along as I went so that I wouldn't make the
mistake of accidentally making the protocol difficult to work with client-side
while being easy to implement compositor-side. We ended up coming up with a
protocol that's slightly different from how other input devices on the system
are handled.  Instead of having everything focused on one global tablet object,
an input seat can have multiple tablet objects. Which is very different from
mouse pointers or touch screens, where all of the various input devices are
multiplexed into one instead of being shown separately. The reason we had to do
this was so that we could tell which tablet was sending each event. With mice,
touchscreens and keyboards the originating device isn't very important, but
with a tablet it's usually important for the client to know which device is
actually sending the events. Again, I also had to go through Weston and learn
how everything works.  Implementing the protocol we came up with took about 2
weeks after I figured out how Weston worked and how to write code for it, and
it was definitely one of the easier parts of my project.

What to prepare yourself for in the GSoC
========================================

As I've already mentioned, one of the hardest parts of the project was getting
myself accustomed to the codebase. It's almost impossible to jump into a
project that you've never worked on before and start getting work done right
away. A huge chunk of the time I spent working on the project was dedicated to
figuring out how things work. So, at the beginning of a GSoC project, don't
expect much to get done, and don't feel discouraged. This is perfectly normal,
and doesn't indicate a lack of skill or talent. Once you start understanding
everything, you'll be able to get far more done and the entire project will
feel much less daunting.

You should also expect to not be working the entire summer. Going into the
project, I had been under the impression that with the exception of the one
week vacation I had planned, that I would be working the entire summer with no
time to myself. This isn't the case, and if anything you should be expecting to
follow a schedule similar to the schedule you might be working at an actual
software company. Granted, you might spend a few extra weekends working on
something to make sure you can get it done on time, but other then that it's
alright to take time off! There were plenty of weekends I didn't do much work
and just hung out with friends or didn't really do anything at all. This being
said though, remember that you'll be working at home, and getting motivated to
work at home is substantially different then working a normal job. This might
not be a problem for some people who have been programming as a hobby for a
while now, but for others it's very likely that it might be a new experience.
Just remember to put your work above other things when necessary.

Another thing is to remember that if you're new to the project, don't be
ashamed of it. The first patches I sent in for libinput had dozens upon dozens
of changes that needed to be made, and that was before they were even posted
publicly on a mailing list. It's not unusual for the first review of your
patches to be *filled* with various corrections that need to be made. The
various style and coding practices you use vary from project to project, and
many of them are not obvious until someone else actually reviews your patches.
Don't be ashamed to tell your mentor that you literally don't understand how
something (or everything) works. Your mentor's job is to help you, and they
will never tell you a question is stupid, or criticize you for being new to a
project. No matter what, I can promise you that you're going to have dozens of
questions for your mentor when your project first starts, and you're going to
continue to have a ton of questions even after you pass the midway point of
your project. So don't feel discouraged if you're constantly asking your mentor
questions, it's perfectly normal!

As for meeting with your mentor, don't expect this to be a huge process. Many
times my mentor and I would only meet up as necessary, e.g. if there wasn't
much progress during the week because I had spent most of it researching the
code, the meeting would just consist of me letting him know where I was
currently at. Also remember that you should take advantage of meetings to ask
your mentor questions, since they're guaranteed to always be available during
your scheduled meetings (unless they say otherwise of course).

What we came up with
====================

The Wayland tablet protocol has three new interfaces:

* `wl_tablet_manager`
* `wl_tablet`
* `wl_tablet_tool`

The first interface, `wl_tablet_manager`, is basically our version of an input
seat for tablets. It's a global singleton object that keeps track of all the
different tablets that are currently connected to the system, and manages
giving out access to these tablets. Tablet's are rather unique input devices,
in that they have a lot of use cases, and a lot of these use cases can be
pretty weird.  For instance, there are situations where an artist might
actually have two tablets connected to their system, and be switching between
them constantly during their work, with different settings binded to each
tablet. In addition, the capabilities of tablets can vary greatly, so it's
important for a compositor to be able to handle them separately, instead of as
one multiplexed object. This is where `wl_tablet_manager` comes in. It's got
only one important event: `device_added`. Whenever the compositor notices
there's a new tablet connected to the system, it adds it to it's list of
tablets and informs all of the clients listening in to events from
`wl_tablet_manager`. In addition, the event comes with all the information a
client might need about the tablet; the name of the tablet, the vendor, the
brand, etc. From there, a client can attach the listener to the new tablet
object included with the `device_added` event and begin receiving input events
from the tablet.

The next interface is `wl_tablet`. As you can probably guess, this is the
interface for a tablet that's connected to the system. This interface sends all
of the input events coming from the tablet to all of the clients listening in.
As of writing this, a `wl_tablet` can send the following events:

* `proximity_in`
* `proximity_out`
* `motion`
* `distance`
* `pressure`
* `tilt`
* `frame`
* `down`
* `up`
* `button`
* `removed`

The first event, `proximity_in`, is similar to the enter event that the cursor
can send. It means that a tablet tool has come into proximity of a client's
surface.  The difference between `proximity_in` and enter, is that a tablet
tool might come into proximity of a client's surface out of nowhere, or it
might be coming into proximity after being on a different surface. A
`proximity_in` event tells the client what surface the tablet tool has come
into proximity on, along with the tool currently in use.

The next event, `proximity_out`, is sent when the tool leaves the proximity of
a surface. Similar to the `proximity_in` event, the tablet tool might not be
going to another surface when it leaves proximity, it might have actually left
physical proximity of the tablet, meaning we can no longer track it's location
and have to make the assumption that it's no longer focused on any client
surfaces.

The next four events; motion, distance, pressure and tilt, are all events that
report the values of the various tablet axes. As you might have guessed, motion
reports the current position of the tool in relativity to the client's surface.
Motion events are also used to inform a client of the starting position of a
tablet tool when it comes into proximity of a surface.

Distance and pressure events give us the current distance of the tool from the
tablet's surface, and the current pressure of the tool against the tablet. As
of now, there's no real world measurement that can be used to convey these to a
client. Because of this, these are both normalized fixed point integers between
0 and 65535. Originally, distance was going to be in millimeters, however after
some experimentation we found that the distance value wasn't actually very
accurate, and that we couldn't really make any sort of guarantee as to the unit
it's in. In the future this could potentially change if we can figure out a way
to accurately come up with a real world unit from the values that the tablet
gives us, for the time being this will be a normalized value.

Tilt is the current angle of the tool in degrees. This event comes with two
values; `tilt_x`, and `tilt_y`. Each of these corresponds to the x and y axis
respectively. In the normal landscape orientation of a tablet, the X axis of
the tool is the vertical tilt of the tablet tool, and the Y axis is the
horizontal tilt of the tool. In a portrait orientation, the X axis is the
horizontal tilt, and the Y axis is the vertical tilt.

The next event is the frame event. To understand what the frame event does, we
have to delve a little into how a compositor reads events from a tablet device.
At specific intervals, a tablet will notify the client of all the current
values of each axis, and any other various important information. For example,
if a person were to hold a tool perfectly still above the tablet's surface, the
tablet would keep sending the current position of the tool, the type of tool in
use, the angle, etc. From there, the kernel picks up the events from the
tablets, and filters out any axes that haven't changed so that the only ones
reported are the ones that have. It then exposes these events through evdev,
the main interface for reading events from input devices on the Linux kernel.
Now, because the tablet sends it's current state at intervals, instead of when
something on the device changes, this means that we get our input events a
packet like structure. The kernel sends an event code with a value for each
value on the axis that has changed, then finishes by sending what's called an
`EV_SYN` frame. This frame indicates that we've received all of the values that
have changed from the tablet since the last time it sent us an update.  From
there, the compositor uses the libinput library to abstract to libevdev, which
handles working with the evdev device. In this process, frame events are only
partially preserved; we can still tell which axes were updated in the same
frame. We can't do the same for buttons or anything else, but most of the time
this isn't necessary so it isn't an issue. We originally planned on doing this
with buttons and implementing it in libinput so that we could group button
presses in the same frame as a `proximity_in` event, but button presses are
usually not sent in the same `EV_SYN` frame. As such, the effort required to
reproduce some sort of frame for button events wasn't worth the trouble, and we
decided against implementing it.

The down and up events are rather simple. A down event indicates that the
tablet tool is now touching the surface of the tablet, and an up event
indicates that the stylus tool has stopped touching the surface of the tablet.
In the event that the tool goes out of proximity before the tool is released
from the tablet's surface, a down event will be sent right before the
proximity-out event.

Button events are simple; they represent a button on the stylus being pressed
or released. Because of the additional complications with pad buttons, only
stylus buttons are reported. The reason for this has to do with the major
inconsistencies with how pad buttons are reported between devices. A great
example can be seen with a Wacom Bamboo tablet, versus a Wacom Intuos Pro
tablet. On the Intuos Pro, buttons are reported from `BTN_0` to `BTN_6`, but on
the bamboo all of the pad buttons emulate mouse buttons. To complicate matters
even more, the device in which the button presses come from is inconsistent. On
the Intuos Pro, the pad button presses are reported from the stylus device, but
on the Bamboo the pad button presses are reported through the pad device.
Because of this, there isn't a reliable way to pick up button presses.  In
addition, the set of buttons can vary widely from tablet to tablet, in addition
to the fact that many tablets also have scroll wheels, touch strips, etc. which
can't be reported well through a normal button interface.  Right now, the
current decision to how we will be handling this is that we will be creating a
separate interface for stray sets of buttons like this, one that can be
associated with other `wl_tablet` interfaces, along with other types of
interfaces as needed.

The removed event indicates that the tablet has been removed from the system,
and no more events will be received from the tablet. At this point, clients
should remove their resources for the tablets and call `wl_tablet_release()`.

The final interface that has been added is `wl_tablet_tool`. This represents a
physical tool that is, or has been used with a tablet. Originally this was just
going to be a tool type and a serial number included with each proximity in
event. Having a separate Wayland interface provides a huge advantage however:
by having an interface, we give clients the ability to map data about the tool
to it's respective object itself, instead of having to keep a list of each tool
type, serial number, etc. Whenever a tool comes into contact, the compositor
checks it's list of tools to see if we've encountered the tool before. If we
learn that we haven't, we create a new tool object for the tool, and report the
existence of the new object to all of the clients that are concerned. If we
find out we have encountered the tool before and already have an object we've
created for it, then we reuse the object in the initial `proximity_in` event
that the tablet sends when the tool first comes into proximity of the tablet.
These resources are shared between tablets, provided that the respective tools
have serial numbers. In the event that the tablet where the tool comes into
proximity doesn't report any sort of serial number, objects are handled a bit
differently.  These tool objects are not shared between tablets, since we
cannot guarantee to the client that the tool objects are unique to each
physical tool. The addition of a tool is indicated with the
`wl_tablet_manager::tool_added` event, which contains the type of the tool,
along with the serial number of the tool. In the event that the tool isn't
expected to come back, e.g. a tool without a serial number whose originating
tablet has been disconnected from the system, the `wl_tablet_tool::removed`
event is sent. At this point, there is no use in the client holding on to the
tool object, and the client should release it using `wl_tablet_tool_release()`.
In addition, the capabilities of each tool are reported with the
`wl_tablet_manager::tool_added` event. Occasionally an axis that is reported by
a tablet might not be supported by all tools. For example: only one of the
Wacom pens can report rotation, regardless of whether or not the tablet can
report the axis. As such, it makes sense to report the tablet's capabilities
through the tool object itself, instead of through the tablet object.

What still needs to be done
===========================

As of writing this post, the following things have yet to be implemented:

* Proper display binding for tablets with built-in displays. Right now tablets
just bind to the primary display, regardless of whether or not they come with a
built-in display.
* Proper heuristics for determining the form factor of a tablet. Right now all
tablets are just reported to be external tablets that lack a screen. Heuristics
for this have already been done in projects like the GNOME project, and just
needs to be ported over to Weston.
* There is currently no support for reporting rotation
* How tilt is reported is still up in the air. Right now we need to implement
capability reporting so that we can tell the client the maximum and minimum
values in degrees that a tablet can report for it's tilt axis. In addition, we
need to change tilt from a normalized value, to an actual value in degrees.
* When a button is held down, it should be grabbed by the surface it was
originally held down on until it's released, regardless of whether or not the
tool goes to another surface. The same goes for the up/down events.
* A client request to change the display that a tablet is bound to.
* Support for mice that can be used with tablets.
