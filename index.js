// Deps
var config = require("./config.json");
var inquirer = require("inquirer");
var rest = require("restler");
var async = require("async");
var fs = require("fs");
var childProcess = require('child_process');
var cwd = process.cwd();

// Config
var rootUrl = config.https ? 'https' : 'http' + '://' + config.host + '/rest/api/1.0/';
var endpoints = {
  projects: rootUrl + 'projects'
};

// Auth object
var user = {
  name : config.user,
  password : null
};

// Ask for password and kick off the process
var questions = [{ type: "password", name: "password", message: "Stash password:"}];
inquirer.prompt(questions, function( answers ) {

  // Set the global user config
  user.password = answers.password;

  // Get PROJECTS
  console.log('   > Loading projects from your Stash account...');
  getProjects(user.password, function(projects) {

    // Ask which project
    var choices = projects.map(function(i) { return i.display});
    var projectSelectionQuestion = [{ type: "list", name: "project", message: "Select a project:", choices: choices}];
    inquirer.prompt(projectSelectionQuestion, function (answers) {

      // Extract selected project
      var targetProject = projects.filter(function(el) {
        if (el.display == answers.project) { return true; }
      })[0];

      // Make sure we've found a project to proceed with
      if(!targetProject) {
        console.log("   x No projects to process");
        process.exit();
      }
      console.log('   > Loading repos from the project...');

      // Get REPOS
      getRepos(user.password, targetProject.key, function(repos) {

        // Build final questions
        var choices = repos.map(function(i) { return i.name });
        var repoSelectionQuestion = [
          { type: "checkbox", name: "repos", message: "Select the repos to manage:", choices: choices},
          { type: "input", name: "location", message: "Target clone folder (will be created if it doesn't exist):"},
        ];

        // Ask which repo(s)
        inquirer.prompt(repoSelectionQuestion, function (answers) {

          // Map answers with repo object array
          var selectedRepos = repos.filter(function(el) {
            if (answers.repos.indexOf(el.name) >= 0) {
              return true;
            }
          });

          // Check/make the dir
          prepFs(answers.location);
          // Clone those repos (with very little error checking)
          cloneRepos(selectedRepos, targetProject.key.toLowerCase());

        });
      });

    });
  });
});

function prepFs(path) {
  // Check/make dir
  var path = path.replace('~', getUserHome());
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }
  if(!fs.lstatSync(path).isDirectory()) {
    console.log(path + ' exists, but is not a valid directory');
    process.exit();
  }
  try {
    process.chdir(path);
  } catch (err) {
    console.log('chdir: ' + err);
    process.exit();
  }
}
function cloneRepos(repos, projectKey) {
  // Clone each repo
  repos.forEach(function(e) {
    if(config.ssh) {
      var cloneUrl = [
          'ssh:/',
          config.ssh + '@' + config.host,
          projectKey,
          e.name + '.git'
      ].join('/');
    } else {
      cloneUrl = e.clone;
    }
    // Clone project
    cloneRepo(cloneUrl);
  });
}
function cloneRepo(cloneUrl) {
  console.log('git clone ' + cloneUrl);
  var cloner = childProcess.exec('git clone ' + cloneUrl, function (error, stdout, stderr) {
    if (error) {
      console.log(error.stack);
      console.log('Error code: '+ error.code);
      console.log('Signal received: '+ error.signal);
    }
    console.log(stdout);
  });
}

function getRepos(password, key, cb) {

  // A doWhilst helps us deal with the paged results from stash
  var repos = [];
  var lastData = {};
  async.doWhilst(
    // Do func
    function(next) {
      rest.get(endpoints.projects + '/' + key + '/repos', {
          username: config.user,
          password: password,
          query: { start: lastData.start || 0 }
        })
        .on('error', errFunc)
        .on('complete', function(data) {
          if(data.errors) {
            return next(data.errors[0].message);
          }

          // Consolidate into projects array
          for (var i = 0, j = data.values.length; i < j; i++) {
            var elem = data.values[i];
            repos.push({
              name: elem.name,
              clone: elem.cloneUrl
            });
          }

          // Save the last response, so we know how to proceed in this loop
          lastData = {
            more: data.isLastPage === false ? true : false,
            start: data.nextPageStart
          };

          next();
        });
    },
    // While func
    function() {
      // Continue loop if the 'more' data flag is true
      return !!lastData.more;
    },
    // Finish func
    function(err) {
      if(err) {
        console.log(err);
        process.exit();
      }
      cb(repos);
    });
}

function getProjects(password, cb) {

  // A doWhilst helps us deal with the paged results from stash
  var projects = [];
  var lastData = {};
  async.doWhilst(
    // Do func
    function(next) {
      rest.get(endpoints.projects, {
          username: config.user,
          password: password,
          query: { start: lastData.start || 0 }
        })
        .on('error', errFunc)
        .on('complete', function(data) {

          if(data.errors) {
            return next(data.errors[0].message);
          } else if (!data.values || !data.values.length) {
            return next('No results');
          }

          // Consolidate into projects array
          for (var i = 0, j = data.values.length; i < j; i++) {
            var elem = data.values[i];
            projects.push({
              id: elem.id,
              key: elem.key,
              name: elem.name,
              display: elem.key + ' (' + elem.name + ')'
            });
          }

          // Save the last response, so we know how to proceed in this loop
          lastData = {
            more: data.isLastPage === false ? true : false,
            start: data.nextPageStart
          };

          next();
        });
    },
    // While func
    function() {
      // Continue loop if the 'more' data flag is true
      return !!lastData.more;
    },
    // Finish func
    function(err) {
      if(err) {
        console.log(err);
        process.exit();
      }
      cb(projects);
    });
}

function errFunc(err) {
  console.log("There was an error fetching data");
  console.log(err.toString());
  process.exit();
}

function getUserHome() {
  return process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
}
