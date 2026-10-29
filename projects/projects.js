import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { fetchJSON, renderProjects } from "../global.js";

// Load the project data
const projects = await fetchJSON("../lib/projects.json");

// Find the container and render the projects into it
const projectsContainer = document.querySelector(".projects");
renderProjects(projects, projectsContainer, "h2");

// Step 1.6: show how many projects there are in the title
const projectsTitle = document.querySelector(".projects-title");
projectsTitle.textContent = `${projects.length} Projects`;

// Step 1: pie chart with sample data
let data = [1, 2, 3, 4, 5, 5];

// Arc generator: turns start/end angles into an SVG path string
let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

// Slice generator: turns data values into start/end angles
let sliceGenerator = d3.pie();
let arcData = sliceGenerator(data);
let arcs = arcData.map((d) => arcGenerator(d));

// Color scale: gives each slice index its own color
let colors = d3.scaleOrdinal(d3.schemeTableau10);

// Draw one <path> per slice
let svg = d3.select("#projects-pie-plot");
arcs.forEach((arc, idx) => {
  svg.append("path").attr("d", arc).attr("fill", colors(idx));
});