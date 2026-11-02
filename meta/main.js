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