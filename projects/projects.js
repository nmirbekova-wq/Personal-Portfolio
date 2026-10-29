import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { fetchJSON, renderProjects } from "../global.js";

// Load the project data
const projects = await fetchJSON("../lib/projects.json");

const projectsContainer = document.querySelector(".projects");
const projectsTitle = document.querySelector(".projects-title");

// One color scale for the whole page, keyed by year
let colors = d3.scaleOrdinal(d3.schemeTableau10);

// The two filters live here, so every update can use both
let query = "";
let selectedYear = null; // null means no slice is selected

// Step 4.4 + 5: draw the pie chart and legend
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

  // Step 5.2: clicking a slice or legend item selects that year,
  // clicking it again deselects it
  function selectYear(year) {
    selectedYear = selectedYear === year ? null : year;
    updatePage();
  }

  // Draw slices
  arcs.forEach((arc, idx) => {
    let year = data[idx].label;
    svg
      .append("path")
      .attr("d", arc)
      .attr("fill", colors(year))
      .attr("class", year === selectedYear ? "selected" : null)
      .on("click", () => selectYear(year));
  });

  // Draw legend
  data.forEach((d) => {
    legend
      .append("li")
      .attr("style", `--color:${colors(d.label)}`)
      .attr("class", d.label === selectedYear ? "legend-item selected" : "legend-item")
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on("click", () => selectYear(d.label));
  });
}

// Step 5.4 fix: one function applies BOTH filters every time
function updatePage() {
  // 1. Search filter
  let searchedProjects = projects.filter((project) => {
    let values = Object.values(project).join("\n").toLowerCase();
    return values.includes(query.toLowerCase());
  });

  // If the selected year has no matches in this search, clear it
  if (!searchedProjects.some((p) => p.year === selectedYear)) {
    selectedYear = null;
  }

  // 2. Year filter, on top of the search results
  let visibleProjects = selectedYear
    ? searchedProjects.filter((p) => p.year === selectedYear)
    : searchedProjects;

  // Cards show both filters; the pie shows the search results,
  // so you can still switch to another year
  renderProjects(visibleProjects, projectsContainer, "h2");
  renderPieChart(searchedProjects);
  let count = visibleProjects.length;
  projectsTitle.textContent = `${count} ${count === 1 ? "Project" : "Projects"}`;
}

// Search updates the query, then redraws everything
let searchInput = document.querySelector(".searchBar");
searchInput.addEventListener("input", (event) => {
  query = event.target.value;
  updatePage();
});

// First draw on page load
updatePage();