import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// Step 1.1: read the CSV and convert text to real numbers and dates
async function loadData() {
  const data = await d3.csv("loc.csv", (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + "T00:00" + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

// Step 1.2: turn line-level rows into one object per commit
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      // Every line in a commit shares the same author and time
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;

      let ret = {
        id: commit,
        url: "https://github.com/nmirbekova-wq/Personal-Portfolio/commit/" + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        // e.g. 2:30 PM becomes 14.5
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      // Keep the original lines, but hide them when printing the object
      Object.defineProperty(ret, "lines", {
        value: lines,
        enumerable: false, // hidden from console.log and loops
        writable: false, // can't be replaced
        configurable: false, // can't be deleted or changed later
      });

      return ret;
    });
}

// Step 1.3: show summary stats
function renderCommitInfo(data, commits) {
  const dl = d3.select("#stats").append("dl").attr("class", "stats");

  // Total lines of code
  dl.append("dt").html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append("dd").text(data.length);

  // Total commits
  dl.append("dt").text("Commits");
  dl.append("dd").text(commits.length);

  // Number of distinct files
  dl.append("dt").text("Files");
  dl.append("dd").text(d3.group(data, (d) => d.file).size);

  // Longest file: max line number within each file, then the biggest one
  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.line),
    (d) => d.file,
  );
  dl.append("dt").text("Longest file");
  dl.append("dd").text(d3.max(fileLengths, (d) => d[1]) + " lines");

  // Deepest indentation level anywhere in the code
  dl.append("dt").text("Max depth");
  dl.append("dd").text(d3.max(data, (d) => d.depth));

  // Time of day with the most lines written
  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.datetime.toLocaleString("en", { dayPeriod: "short" }),
  );
  const maxPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0];
  dl.append("dt").text("Most active");
  dl.append("dd").text(maxPeriod.replace(/^(in the|at) /, ""));
}

let data = await loadData();
let commits = processCommits(data);
console.log(commits);

renderCommitInfo(data, commits);

// Scales live outside the function so brushing (Step 5) can use them
let xScale;
let yScale;

// Step 2: scatterplot of commits by date and time of day
function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;

  // Space around the chart for the axes
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("overflow", "visible");

  // Scales: data values to pixel positions
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // Step 4.1-4.2: dot area grows with lines edited (square root scale)
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([3, 25]);

  // Step 4.3: draw big dots first so small ones stay on top and hoverable
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  // Step 2.3: gridlines first, so they sit behind everything
  const gridlines = svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left}, 0)`);

  gridlines.call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width));

  // Step 2.1: one dot per commit
  const dots = svg.append("g").attr("class", "dots");

  dots
    .selectAll("circle")
    .data(sortedCommits)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .style("fill-opacity", 0.7)
    // Step 3: show the tooltip while hovering a dot
    .on("mouseenter", (event, commit) => {
      d3.select(event.currentTarget).style("fill-opacity", 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mousemove", (event) => {
      updateTooltipPosition(event);
    })
    .on("mouseleave", (event) => {
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
      updateTooltipVisibility(false);
    });

  // Step 2.2: axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");

  svg
    .append("g")
    .attr("transform", `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg
    .append("g")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(yAxis);
  createBrushSelector(svg);
}

// Step 3.1: fill the tooltip with one commit's info
function renderTooltipContent(commit) {
  const link = document.getElementById("commit-link");
  const date = document.getElementById("commit-date");
  const time = document.getElementById("commit-time");
  const author = document.getElementById("commit-author");
  const lines = document.getElementById("commit-lines");

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString("en", { dateStyle: "full" });
  time.textContent = commit.datetime?.toLocaleString("en", { timeStyle: "short" });
  author.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

// Step 3.3: show or hide the tooltip
function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById("commit-tooltip");
  tooltip.hidden = !isVisible;
}

// Step 3.4: place the tooltip next to the mouse,
// flipping to the other side if it would go off screen
function updateTooltipPosition(event) {
  const tooltip = document.getElementById("commit-tooltip");
  const gap = 12;
  let x = event.clientX + gap;
  let y = event.clientY + gap;

  if (x + tooltip.offsetWidth > window.innerWidth) {
    x = event.clientX - tooltip.offsetWidth - gap;
  }
  if (y + tooltip.offsetHeight > window.innerHeight) {
    y = event.clientY - tooltip.offsetHeight - gap;
  }

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

// Step 5.1-5.2: set up the brush, then put the dots back on top
// so hovering still works
function createBrushSelector(svg) {
  svg.call(d3.brush().on("start brush end", brushed));
  svg.selectAll(".dots, .overlay ~ *").raise();
}

// Step 5.4: runs every time the brush moves
function brushed(event) {
  const selection = event.selection;
  d3.selectAll(".dots circle").classed("selected", (d) =>
    isCommitSelected(selection, d),
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

// Is this commit's dot inside the brushed rectangle?
function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

// Step 5.5: show how many commits are selected
function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const count = selectedCommits.length;
  const countElement = document.querySelector("#selection-count");
  countElement.textContent = `${count || "No"} ${count === 1 ? "commit" : "commits"} selected`;

  return selectedCommits;
}

// Step 5.6: show which languages the selected commits touched
function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById("language-breakdown");

  if (selectedCommits.length === 0) {
    container.innerHTML = "";
    return;
  }

  // All lines from the selected commits, in one flat array
  const lines = selectedCommits.flatMap((d) => d.lines);

  // Count lines per language (css, html, js)
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  container.innerHTML = "";

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format(".1~%")(proportion);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${formatted}<small>${count} lines</small></dd>
    `;
  }
}

renderScatterPlot(data, commits);