console.log("IT'S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Step 2.1: get all nav links as an array
let navLinks = $$("nav a");

// Step 2.2: find the link whose URL matches the current page
let currentLink = navLinks.find(
  (a) => a.host === location.host && a.pathname === location.pathname,
);

// Step 2.3: highlight it (?. skips this if no link was found)
currentLink?.classList.add("current");