import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

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
    })
    // Oldest commit first (needed for the slider and scrolling story)
    .sort((a, b) => a.datetime - b.datetime);
}

// Step 1.3: show summary stats
function renderCommitInfo(data, commits) {
  // Clear old stats first, so this can run again when the slider moves
  d3.select("#stats").selectAll("*").remove();
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

// Lab 8 Step 1.2: the commits currently shown (all of them at first)
let filteredCommits = commits;

renderCommitInfo(data, commits);

// Scales live outside the functions so updates and brushing can use them
let xScale;
let yScale;
let rScale;

// Chart size and the space around it for the axes
const width = 1000;
const height = 600;
const margin = { top: 10, right: 10, bottom: 30, left: 40 };
const usableArea = {
  top: margin.top,
  right: width - margin.right,
  bottom: height - margin.bottom,
  left: margin.left,
  width: width - margin.left - margin.right,
  height: height - margin.top - margin.bottom,
};

// Lab 6 Step 2: build the chart once (svg, scales, gridlines, axes, brush)
function renderScatterPlot(data, commits) {
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

  // Dot area grows with lines edited. Based on ALL commits, so a commit
  // keeps the same size no matter where the slider is.
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([3, 25]);

  // Gridlines first, so they sit behind everything
  svg
    .append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width));

  // Empty group for the dots (filled in by updateScatterPlot)
  svg.append("g").attr("class", "dots");

  // Axes, with classes so updateScatterPlot can find the x-axis later
  svg
    .append("g")
    .attr("transform", `translate(0, ${usableArea.bottom})`)
    .attr("class", "x-axis")
    .call(d3.axisBottom(xScale));

  svg
    .append("g")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .attr("class", "y-axis")
    .call(
      d3.axisLeft(yScale).tickFormat((d) => String(d % 24).padStart(2, "0") + ":00"),
    );

  // Brushing
  createBrushSelector(svg);

  // Draw the dots
  updateScatterPlot(data, commits);
}

// Lab 8 Step 1.2: update the existing chart instead of drawing a new one
function updateScatterPlot(data, commits) {
  const svg = d3.select("#chart").select("svg");

  // Stretch the x-axis to the commits being shown
  xScale.domain(d3.extent(commits, (d) => d.datetime)).nice();

  const xAxisGroup = svg.select("g.x-axis");
  xAxisGroup.selectAll("*").remove();
  xAxisGroup.call(d3.axisBottom(xScale));

  // Big dots first so small ones stay on top and hoverable
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  // Step 1.3: the key (d.id) makes each commit keep its own circle
  svg
    .select("g.dots")
    .selectAll("circle")
    .data(sortedCommits, (d) => d.id)
    .join("circle")
    .attr("cx", (d) => xScale(d.datetime))
    .attr("cy", (d) => yScale(d.hourFrac))
    .attr("r", (d) => rScale(d.totalLines))
    .style("--r", (d) => rScale(d.totalLines))
    .style("fill-opacity", 0.7)
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
}

// Step 3.1: fill the tooltip with one commit's info
function renderTooltipContent(commit) {
  const link = document.getElementById("commit-link");
  const date = document.getElementById("commit-date");
  const time = document.getElementById("tooltip-time");
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
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const count = selectedCommits.length;
  const countElement = document.querySelector("#selection-count");
  countElement.textContent = `${count || "No"} ${count === 1 ? "commit" : "commits"} selected`;

  return selectedCommits;
}

// Step 5.6: show which languages the selected commits touched
function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
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

// Lab 8 Step 2.4: one color per language (css, html, js)
let fileColors = d3.scaleOrdinal(d3.schemeTableau10);

// Lab 8 Step 2: unit visualization, one dot per line of code, grouped by file
function updateFileDisplay(filteredCommits) {
  // All lines from the commits shown, grouped by file, biggest file first
  let lines = filteredCommits.flatMap((d) => d.lines);
  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    })
    .sort((a, b) => b.lines.length - a.lines.length);

  // One <div> (with a <dt> and <dd>) per file.
  // ":scope > div" picks only the file rows, not the line dots inside them.
  let filesContainer = d3
    .select("#files")
    .selectAll(":scope > div")
    .data(files, (d) => d.name)
    .join(
      // This only runs when a file first appears
      (enter) =>
        enter.append("div").call((div) => {
          div.append("dt");
          div.append("dd");
        }),
    )
    .order(); // move the rows into the new sorted order

  // File name, with its line count underneath
  filesContainer
    .select("dt")
    .html((d) => `<code>${d.name}</code><small>${d.lines.length} lines</small>`);

  // One small dot per line, colored by language
  filesContainer
    .select("dd")
    .selectAll("div")
    .data((d) => d.lines)
    .join("div")
    .attr("class", "loc")
    .attr("style", (d) => `--color: ${fileColors(d.type)}`);
}

// Lab 8 Step 1.1: slider from 0 to 100 (% of the time from first to last commit)
let commitProgress = 100;

// Turns 0-100 into a date, and back
let timeScale = d3
  .scaleTime()
  .domain([d3.min(commits, (d) => d.datetime), d3.max(commits, (d) => d.datetime)])
  .range([0, 100]);

let commitMaxTime = timeScale.invert(commitProgress);

const timeSlider = document.getElementById("commit-progress");
const selectedTime = document.getElementById("commit-time");

// Redraw everything for commits up to commitMaxTime
function updateForTime() {
  selectedTime.textContent = commitMaxTime.toLocaleString("en", {
    dateStyle: "long",
    timeStyle: "short",
  });

  // Step 1.2: keep only commits up to that time, then redraw
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  let filteredData = filteredCommits.flatMap((d) => d.lines);

  updateScatterPlot(data, filteredCommits);
  renderCommitInfo(filteredData, filteredCommits);
  updateFileDisplay(filteredCommits);
}

// The slider sets the time from its 0-100 value
function onTimeSliderChange() {
  commitProgress = Number(timeSlider.value);
  commitMaxTime = timeScale.invert(commitProgress);
  updateForTime();
}

timeSlider.addEventListener("input", onTimeSliderChange);
onTimeSliderChange();

// Lab 8 Step 3.2: one paragraph of story per commit
d3.select("#scatter-story")
  .selectAll(".step")
  .data(commits)
  .join("div")
  .attr("class", "step")
  .html((d, i) => {
    const date = d.datetime.toLocaleString("en", {
      dateStyle: "full",
      timeStyle: "short",
    });
    const fileCount = d3.rollups(
      d.lines,
      (D) => D.length,
      (d) => d.file,
    ).length;
    const commitText =
      i === 0
        ? "my first commit, and it was glorious"
        : i === commits.length - 1
          ? "my latest commit"
          : "another glorious commit";

    return `
      <time>${date}</time>
      <p>
        I made <a href="${d.url}" target="_blank">${commitText}</a>.
        I edited ${d.totalLines} ${d.totalLines === 1 ? "line" : "lines"}
        across ${fileCount} ${fileCount === 1 ? "file" : "files"}.
        Then I looked over all I had made, and I saw that it was very good.
      </p>
    `;
  });

// Lab 8 Step 3.3: when a story step reaches the middle of the screen,
// show the chart as of that commit
function onStepEnter(response) {
  const commit = response.element.__data__;
  commitMaxTime = commit.datetime;

  // Keep the slider in sync with the story
  commitProgress = timeScale(commitMaxTime);
  timeSlider.value = commitProgress;

  updateForTime();
}

const scroller = scrollama();
scroller
  .setup({
    container: "#scrolly-1",
    step: "#scrolly-1 .step",
  })
  .onStepEnter(onStepEnter);