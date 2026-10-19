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

// Step 4.2: add the theme dropdown to every page
let isDark = matchMedia("(prefers-color-scheme: dark)").matches;

document.body.insertAdjacentHTML(
  "afterbegin",
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic (${isDark ? "Dark" : "Light"})</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>`,
);

let select = document.querySelector(".color-scheme select");

// One function that applies a theme, used in two places below
function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty("color-scheme", colorScheme);
  select.value = colorScheme;
}

// Step 4.5: on page load, apply the saved theme if there is one
if ("colorScheme" in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

// Step 4.4: when the user picks a theme, apply it and save it
select.addEventListener("input", function (event) {
  console.log("color scheme changed to", event.target.value);
  setColorScheme(event.target.value);
  localStorage.colorScheme = event.target.value;
});

// Step 5: build the mailto URL ourselves with proper encoding
let form = document.querySelector("form");

form?.addEventListener("submit", function (event) {
  // Stop the browser's default submit
  event.preventDefault();

  // Collect all the form fields
  let data = new FormData(form);
  let params = [];

  for (let [name, value] of data) {
    console.log(name, value, encodeURIComponent(value));
    params.push(name + "=" + encodeURIComponent(value));
  }

  // Example: mailto:nmirbekova@ucsd.edu?subject=Hello%20there&body=Hi
  let url = form.action + "?" + params.join("&");
  location.href = url;
});

// Step 1.2: load a JSON file and return the data
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    console.log(response);

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching or parsing JSON data:", error);
  }
}

// Step 1.4: turn an array of projects into <article> elements
export function renderProjects(projects, containerElement, headingLevel = "h2") {
  // Stop if the container doesn't exist
  if (!containerElement) {
    console.error("renderProjects: container element not found");
    return;
  }

  // Only allow h1 to h6, otherwise fall back to h2
  if (!/^h[1-6]$/.test(headingLevel)) {
    headingLevel = "h2";
  }

  // Clear old content so projects don't get added twice
  containerElement.innerHTML = "";

  // Show a message if there are no projects
  if (!projects || projects.length === 0) {
    containerElement.innerHTML = "<p>No projects to show yet.</p>";
    return;
  }

  for (let project of projects) {
    const article = document.createElement("article");
    article.innerHTML = `
      <${headingLevel}>${project.title}</${headingLevel}>
      <img src="${project.image}" alt="${project.title}">
      <p>${project.description}</p>
    `;
    containerElement.appendChild(article);
  }
}