// https://groups.google.com/group/activity-streams/feed/rss_v2_0_msgs.xml?num=100

/*
*
* Copyright (C) 2011, The Locker Project
* All rights reserved.
*
* Please see the LICENSE file for more information.
*
*/

/**
 * archive a public google group via the rss feed
 * TODO: scrape the old archives
 */

var _debug = false;

var fs = require('fs'),
    http = require('http'),
    url = require('url'),
    express = require('express'),
    connect = require('connect'),
    jsdom = require('jsdom'),
    request = require('request'),
    sys = require('sys'),
    app = express.createServer(
                    connect.bodyParser(),
                    connect.cookieParser(),
                    connect.session({secret : "locker"})),
    locker = require('../../Common/node/locker.js'),
    lfs = require('../../Common/node/lfs.js');

var wwwdude = require('wwwdude'),
    wwwdude_client = wwwdude.createClient({ encoding: 'binary' });

var me, group, latests, userInfo;

app.set('views', __dirname);
app.get('/',
function(req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/html'
    });
    res.end("<html> Enter your Google Group Name" +
            "<form method='get' action='save'>" +
                "Name: <input name='groupUrl'><br>" +
                "<input type='submit' value='Save'>" +
            "</form></html>");
    return;
});

app.get('/save',
function(req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/html'
    });
    if(!req.param('groupUrl')) {
        res.end("missing field(s)?");
        return;
    }
    group = req.param('groupUrl');
    lfs.writeObjectToFile('group.json', group);
    res.redirect("/feed");
});

app.get('/feed',
function(req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/html'
    });
    lfs.readObjectsFromFile('feed.json', function(data) {
        var obj = {};
        obj.data = data;
        res.write(JSON.stringify(obj));
        res.end();
    });
    pullNewsFeed(function() {
        locker.at('/feed', 3600);
        res.end();
    });
});

function fetchFeed(feedUrl, callback) {  
  var feed = url.parse(feedUrl);
  request({uri:feed.href}, function (error, resp, body) {
    if (error) stdout.write(JSON.stringify(["error", sys.error(error.stack)])+'\n');
    jsdom.env(body, ['jquery.js', 'jfeed.js', 'jatom.js', 'jfeeditem.js', 'jrss.js'], function(errors, window) {
      var jf = new window.JFeed(window.document);
      callback(jf);
    });
  })
}

function pullNewsFeed(since, items, callback) {
    if(!latests.feed)
        latests.feed = {};
    var items = [];
    var since = latests.feed.latest;
    var params = {};
    if(since) params.since = since;
    var ggurl = "https://groups.google.com/group/" + group.url + "/feed/rss_v2_0_msgs.xml?num=100";
    fetchFeed(ggurl, function(feed) {
        if(result.data.length > 0) {
            var t = result.data[0].updated_time;
            if(!latests.feed.latest || t > latests.feed.latest)
                latests.feed.latest = t;
            console.log(JSON.stringify(latests));
            for(var i = 0; i < result.data.length; i++)
                items.push(result.data[i]);
            var next = result.paging.next;
            var until = unescape(next.substring(next.lastIndexOf("&until=") + 7));
            pullNewsFeedPage(until, since, items, callback);
        } else if(callback) {
            lfs.writeObjectToFile('latests.json', latests);
            callback();
        }
    });
}


var stdin = process.openStdin();
stdin.setEncoding('utf8');
stdin.on('data', function (chunk) {
    var processInfo = JSON.parse(chunk);
    locker.initClient(processInfo);
    process.chdir(processInfo.workingDirectory);
    lfs.readObjectFromFile('latests.json', function(newLatests) {
        lfs.readObjectFromFile('group.json', function(groupConfig) {
            group = groupConfig;
            latests = newLatests;
            me = lfs.loadMeData();
            app.listen(processInfo.port);
            var returnedInfo = {port: processInfo.port};
            console.log(JSON.stringify(returnedInfo));
        });
    });
});
