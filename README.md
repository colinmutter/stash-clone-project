# Clone Project (for Stash)
Command line utility to bulk-clone repos from Atlassian's Stash.

![stash-clone-project screenshot](http://snag.gy/BvGyw.jpg "stash-clone-project screenshot")

### About
This is a simple nodejs script to tap into the Stash API to allow you to clone one or more repos from a project.  This is handy when you have projects with a large number of co-dependent repositories and just want to clone them all quickly.


### Config
To get started fill out the config.json file

```
{
  "user": "your stash username",
  "host": "yout stash host",
  "https": false,
  "ssh": "git+ssh username (optional)"
}
```

### Clone!

```
npm install
node index.js
```
