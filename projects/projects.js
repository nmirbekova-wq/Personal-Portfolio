import { fetchJSON, renderProjects } from "../global.js";

// Load the project data
const projects = await fetchJSON("../lib/projects.json");

// Find the container and render the projects into it
const projectsContainer = document.querySelector(".projects");
renderProjects(projects, projectsContainer, "h2");

// Step 1.6: show how many projects there are in the title
const projectsTitle = document.querySelector(".projects-title");
projectsTitle.textContent = `${projects.length} Projects`;