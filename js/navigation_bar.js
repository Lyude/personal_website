/* ©2014 Stephen Chandler "Lyude" Paul
 * This file is licensed under the WTFPL
 * See http://www.wtfpl.net/about/ for more info
 */
const goToTopButtonAnimationTime = 300;

var goToTopButton;
var socialMediaIcons;

function toggleNavBarAttached(v) {
	if (v) {
		document.getElementsByTagName('nav')[0].classList.remove('detached');
		document.getElementsByTagName('nav')[0].classList.add('attached');

		socialMediaIcons.removeClass("detached");
		socialMediaIcons.addClass("attached");
	}
	else {
		document.getElementsByTagName('nav')[0].classList.remove('attached');
		document.getElementsByTagName('nav')[0].classList.add('detached');

		socialMediaIcons.addClass("detached");
		socialMediaIcons.removeClass("attached");
	}
}

function windowScrollHandler() {
	if (window.scrollY > 0) {
		toggleNavBarAttached(false);
		goToTopButton.fadeIn(goToTopButtonAnimationTime);
	}
	else {
		toggleNavBarAttached(true);
		goToTopButton.fadeOut(goToTopButtonAnimationTime);
	}
}

window.onscroll = windowScrollHandler;

window.onload = function () {
	socialMediaIcons = $("#social_media");
	/* In order to ensure the animation of the navigation buttons on the
	 * right side are smooth, we basically want to make their positions
	 * absolute, and handle moving them ourselves with javascript
	 */
	goToTopButton = $("#go_to_top");
	goToTopButton.hide();
	goToTopButton.css("visibility", "visible");

	document.getElementById("social_media").classList.add("handled_by_js");
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

