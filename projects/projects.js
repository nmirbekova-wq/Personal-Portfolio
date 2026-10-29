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

// Step 3: count projects per year
let rolledData = d3.rollups(
  projects,
  (v) => v.length,
  (d) => d.year,
);

// Sort years oldest to newest so the legend reads in order
rolledData.sort((a, b) => a[0] - b[0]);

// Turn [year, count] pairs into { value, label } objects
let data = rolledData.map(([year, count]) => {
  return { value: count, label: year };
});

// Step 1: build the pie slices
let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
let sliceGenerator = d3.pie().value((d) => d.value);
let arcData = sliceGenerator(data);
let arcs = arcData.map((d) => arcGenerator(d));
let colors = d3.scaleOrdinal(d3.schemeTableau10);

let svg = d3.select("#projects-pie-plot");
arcs.forEach((arc, idx) => {
  svg.append("path").attr("d", arc).attr("fill", colors(idx));
});

// Step 2.2: build the legend
let legend = d3.select(".legend");
data.forEach((d, idx) => {
  legend
    .append("li")
    .attr("style", `--color:${colors(idx)}`)
    .attr("class", "legend-item")
    .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
});