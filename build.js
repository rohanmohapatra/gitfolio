/* Filepath utilities */
const path = require("path");
/* Promise library */
const bluebird = require("bluebird");
const hbs = require("handlebars");
/*  Creates promise-returning async functions
    from callback-passed async functions      */
const fs = bluebird.promisifyAll(require("fs"));
const { COPYFILE_EXCL } = fs.constants;
const { updateHTML } = require("./populate");
const {
  getConfig,
  outDir,
  defaultSocialsPath,
  defaultIgnoredPath
} = require("./utils");

const assetDir = path.resolve(`${__dirname}/assets/`);
const config = path.join(outDir, "config.json");
const social = path.join(outDir, "social.json");
const ignored = path.join(outDir, "ignore.json");

/**
 * Creates the stylesheet used by the site from a template stylesheet.
 *
 * Theme styles are added to the new stylesheet depending on command line
 * arguments.
 */
async function populateCSS({
  theme = "light",
  background = "https://images.unsplash.com/photo-1553748024-d1b27fb3f960?w=500&h=1000&q=80&fit=crop"
} = {}) {
  /* Get the theme the user requests. Defaults to 'light' */
  theme = `${theme}.css`;
  let template = path.resolve(assetDir, "index.css");
  let stylesheet = path.join(outDir, "index.css");

  let serviceWorker = path.resolve(assetDir, "service-worker.js");

  try {
    await fs.accessAsync(outDir, fs.constants.F_OK);
  } catch (err) {
    await fs.mkdirAsync(outDir);
  }
  /* Copy over the template CSS stylesheet */
  await fs.copyFileAsync(template, stylesheet);

  /* Add Service Worker */
  await fs.copyFileSync(serviceWorker, `${outDir}/service-worker.js`);

  /* Get an array of every available theme */
  let themes = await fs.readdirAsync(path.join(assetDir, "themes"));

  if (!themes.includes(theme)) {
    console.error('Error: Requested theme not found. Defaulting to "light".');
    theme = "light";
  }
  /* Read in the theme stylesheet */
  let themeSource = await fs.readFileSync(path.join(assetDir, "themes", theme));
  themeSource = themeSource.toString("utf-8");
  let themeTemplate = hbs.compile(themeSource);
  let styles = themeTemplate({
    background: `${background}`
  });
  /* Add the user-specified styles to the new stylesheet */
  await fs.appendFileAsync(stylesheet, styles);

  /* Update the config file with the user's theme choice */
  const data = await getConfig();
  data[0].theme = theme;
  await fs.writeFileAsync(config, JSON.stringify(data, null, " "));
}

async function populateConfig(sort, order, includeFork, gitLab) {
  const data = await getConfig();
  data[0].sort = sort;
  data[0].order = order;
  data[0].includeFork = includeFork;
  data[0].gitLabUserName = gitLab;
  await fs.writeFileAsync(config, JSON.stringify(data, null, " "));
}

async function populateSocials() {
  // nothing much to do here as this should be edited by the user
  fs.copyFile(defaultSocialsPath, social, COPYFILE_EXCL, err => {
    // file already exists, nothing to do
  });
}

async function populateIgnored() {
  // move a default file to the dist
  fs.copyFile(defaultIgnoredPath, ignored, COPYFILE_EXCL, err => {
    // ignore existing err
  });
}

async function buildCommand(username, program) {
  await populateCSS(program);
  await populateSocials();
  await populateIgnored();
  let sort = program.sort ? program.sort : "created";
  let order = program.order ? program.order : "asc";
  let includeFork = program.fork ? true : false;
  let image = program.ogimage;
  let gitlab = program.gitlab;
  await populateConfig(sort, order, includeFork, gitlab);
  updateHTML(("%s", username), sort, order, includeFork, image, gitlab);
}

module.exports = {
  buildCommand
};
