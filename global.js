console.log("IT'S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Step 2 (no longer needed, the nav is built by JS below)
// let navLinks = $$("nav a");
// let currentLink = navLinks.find(
//   (a) => a.host === location.host && a.pathname === location.pathname,
// );
// currentLink?.classList.add("current");

// Step 3.1: list of pages for the nav
let pages = [
  { url: "", title: "Home" },
  { url: "projects/", title: "Projects" },
  { url: "contact/", title: "Contact" },
  { url: "cv/", title: "CV" },
  { url: "https://github.com/nmirbekova-wq", title: "GitHub" },
];

// Local server uses "/", GitHub Pages uses "/repo-name/"
const BASE_PATH =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "/"
    : "/Personal-Portfolio/";

// Create the nav and put it at the start of <body>
let nav = document.createElement("nav");
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  let title = p.title;

  // Add BASE_PATH to internal links only
  url = !url.startsWith("http") ? BASE_PATH + url : url;

  // Step 3.2: create the link as an element
  let a = document.createElement("a");
  a.href = url;
  a.textContent = title;

  // Highlight the current page
  a.classList.toggle(
    "current",
    a.host === location.host && a.pathname === location.pathname,
  );

  // Open external links (GitHub) in a new tab
  a.toggleAttribute("target", a.host !== location.host);
  if (a.host !== location.host) {
    a.target = "_blank";
  }

  nav.append(a);
}