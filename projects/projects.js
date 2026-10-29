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

// One color scale for the whole page, keyed by year
let colors = d3.scaleOrdinal(d3.schemeTableau10);

// Step 4.4: all the chart code in one function, so it can redraw
function renderPieChart(projectsGiven) {
  // Count projects per year
  let rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );
  rolledData.sort((a, b) => a[0] - b[0]);

  let data = rolledData.map(([year, count]) => {
    return { value: count, label: year };
  });

  // Build the slices
  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  let sliceGenerator = d3.pie().value((d) => d.value);
  let arcData = sliceGenerator(data);
  let arcs = arcData.map((d) => arcGenerator(d));

  // Clear the old chart and legend before drawing again
  let svg = d3.select("#projects-pie-plot");
  svg.selectAll("path").remove();

  let legend = d3.select(".legend");
  legend.selectAll("li").remove();

  // Draw slices
  arcs.forEach((arc, idx) => {
    svg.append("path").attr("d", arc).attr("fill", colors(data[idx].label));
  });

  // Draw legend
  data.forEach((d) => {
    legend
      .append("li")
      .attr("style", `--color:${colors(d.label)}`)
      .attr("class", "legend-item")
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });
}

// Draw the chart once when the page loads
renderPieChart(projects);

// Steps 4.1 to 4.3: search
let query = "";
let searchInput = document.querySelector(".searchBar");

searchInput.addEventListener("input", (event) => {
  query = event.target.value;

  // Keep projects where any field contains the query, ignoring case
  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join("\n").toLowerCase();
    return values.includes(query.toLowerCase());
  });

  // Redraw both the cards and the chart
  renderProjects(filteredProjects, projectsContainer, "h2");
  renderPieChart(filteredProjects);
});