---
title: ncurses and the escape key
description: A much needed explanation of how ncurses actually handles the escape key
categories: [ "programming" ]
layout: post
---
One of the things I've noticed is that on the Internet, there's a lack of proper explanation of how ncurses actually handles the escape key. Many people seem to think that once `keypad(stdscr, true);` is called, the escape key can't be handled properly. However, this isn't actually true and the escape key can be handled in keypad mode.

How to handle the escape key in keypad mode
-------------------------------------------
By default, enabling keypad mode on `stdscr` will stop you from being able to handle the escape key, but there is a little known enviornment variable that ncurses can actually use to check whether or not the escape key was pressed. This variable is `ESCDELAY`. Taken from the man page `curs_variables`:

> This variable holds the number of milliseconds to wait after reading an escape character, to distinguish between an individual escape character entered on the keyboard from escape sequences sent by cursor- and function-keys (see curses(3X)).

By default, this variable is set to 1000 (at least on my system), which is kind of long and unecessary. For anyone who's new to programming, a simple fix in C for changing this in your program to a value like 25 would be:

{% highlight c %}
#include <stdlib.h>
/* … */
	setenv("ESCDELAY", 25, 0);
/* … */
{% endhighlight %}

Of course, don't forget to call this _before_ you setup ncurses in your program

Any value less then 100 should work well, since 100ms is the supposedly the smallest length of time a human can recognize. Once you've done that, all you need to do is check for the keycode `27`, and you're good to go!

**Warning**: When discovering this, I also found out that `<linux/input.h>` actually defines a macro called `KEY_ESC`, which is rather similar to the keycode macros ncurses defines but does not evaluate to the same keycode as the escape key. This is a rather unlikely scenario for most people (I only found this out because the libinput headers pull this header in), but it caused me a little trouble so I thought I'd mention it here :)
