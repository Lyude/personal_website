/* ©2014 Stephen Chandler "Lyude" Paul
 * This file is licensed under the WTFPL
 * See http://www.wtfpl.net/about/ for more info
 */
const goToTopButtonAnimationTime = 300;

goToTopButton = $("#go_to_top");

function toggleNavBarAttached(v) {
	if (v) {
		document.getElementsByTagName('nav')[0].classList.remove('detached');
		document.getElementsByTagName('nav')[0].classList.add('attached');
	}
	else {
		document.getElementsByTagName('nav')[0].classList.remove('attached');
		document.getElementsByTagName('nav')[0].classList.add('detached');
	}
}

function windowScrollHandler() {
	if (window.scrollY > 0) {
		toggleNavBarAttached(false);
		goToTopButton.fadeIn(goToTopButtonAnimationTime)
	}
	else {
		toggleNavBarAttached(true);
		goToTopButton.fadeOut(goToTopButtonAnimationTime);
	}
}

window.onscroll = windowScrollHandler;

window.onload = function () {
	/* We have the css style for the Go To Top button set to make the button
	   invisible by default, this makes it so that we don't have to wait for
	   jQuery to load for the button's visibility status to be updated properly
	   This here just makes it so that when jQuery loads, we pass over the
	   responsibility of handling the Go To Top button's visibility to
	   javascript */
	goToTopButton.hide();
	goToTopButton.css("visibility", "visible");
}

function smoothScrollToTop() {
	goToTopButton.fadeOut(goToTopButtonAnimationTime);

	/* Make sure the shadow doesn't keep changing while
	   we're running the animation */
	window.onscroll = null;

	$("html, body").animate({ scrollTop: 0 }, 700);

	setTimeout(function() {
		toggleNavBarAttached(true);
		window.onscroll = windowScrollHandler;
	}, 700);
}

