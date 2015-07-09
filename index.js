// required modules
var tabs = require("sdk/tabs"),
	utils = require('sdk/window/utils'),
	self = require('sdk/self'),
	ActionButton = require("sdk/ui/button/action").ActionButton,
	storage = require("sdk/simple-storage"),
	Request = require("sdk/request").Request;

// internal modules
var URI = require('./vendor/URI.js'),
	CONSTANTS = {

		DOMAINS_KEY: 'domains',
		INSTALL_KEY: 'install',
		CACHE: 60

	},
	CURRENT_TAB = null;

/**
* Opens a tab to the welcome page when the addon is first installed
**/
function installNotice() {

	// check if we gave the welcome page already
	if(!storage.storage[ CONSTANTS.INSTALL_KEY ]) {

		// current date
		current_date = new Date()

		// set the key
		storage.storage[ CONSTANTS.INSTALL_KEY ] = current_date.getTime()

		// open the welcome page
		tabs.open("http://passmarked.com/welcome?source=firefox.ext&timestamp=" + current_date.getTime())

	}

}

/** 
* Finds the domain from the cache
**/
function byCache(domain_str, fn) {

	// is there not a cache ?
	if(storage[CONSTANTS.DOMAINS_KEY]) {

		// current timestamp
		current_timestamp = new Date().getTime()

		// loop all the domains
		for (let report_obj of  (storage[CONSTANTS.DOMAINS_KEY] || []) ) {

			// check if domain matches
			if( report_obj.domain === domain_str ) {

				if( ( current_timestamp - report_obj.timestamp ) <= 1000 * 60 * CONSTANTS.CACHE) {

					// return the time
					fn(report_obj);

				} else {

					// return nothing
					fn(null);

				}

				// stop here
				return;

			}

		}

		// handle defaults
		fn(null)

	} else fn(null);

}

/**
* Handles getting data from our store
**/
function getReportInfoByURL(url_str, fn) {

	// parse the url
	var url_obj = URI(url_str);

	// find the hostname
	var hostname_str = ( url_obj.hostname() ).toLowerCase();

	// check the cache
	byCache( hostname_str, function(result) {

		// if we found a result
		if(!result) {

			Request({
			  url: "https://api.passmarked.com/query?domain=" + hostname_str,
			  onComplete: function (response) {

			    // start our response
			    var current_param = response.json || {};

			    // param to add
			    current_param.domain = hostname_str;
			    current_param.timestamp = new Date().getTime()

			    // set the cache
			    if(!storage.storage[ CONSTANTS.DOMAINS_KEY ])
			    	storage.storage[ CONSTANTS.DOMAINS_KEY ] = [];

			    // add the storage
			    storage.storage[ CONSTANTS.DOMAINS_KEY ].push( current_param )

			    // handle back
			    fn(current_param);

			  }
			}).get();

		} else fn(result);

	} );

}

/**
* Shows the table
**/
function handleIconClick(url_str) {

	// check if not the password result website
	if(url.indexOf('passmarked.com') != -1 && url.replace('http:').split('/').length > 4) {

		// open up the tabs
		tabs.open("http://passmarked.com/dawg?source=firefox.ext&url=" + encodeURIComponent(url_str)) 

	else {

		// open up the tabs
		tabs.open("https://api.passmarked.com/redirect?url=" + encodeURIComponent(url_str)) 

	}

}

/**
* Show a blank icon
**/
function showIcon(tab, score) {

	// get the doc
	var doc = utils.getMostRecentBrowserWindow().document;

	// get a button
	var btn = doc.getElementById('passmarkbadge');

	// check for a element
	if(btn) {

		// remove the btn
		btn.parentElement.removeChild(btn);

	}

	// pick a badge to use
	var badge_path_str = self.data.url('logo.png');

	// check for a score
	/* if( Math.floor(score) > 0 )
		badge_path_str = self.data.url('scores/' + Math.floor(score) + '.png'); */

	// create the button
	var urlBarIcons = doc.getElementById('urlbar-icons')
	var btn = doc.createElement('image');
	btn.setAttribute('id', 'passmarkbadge');
	btn.width = '16px'
	btn.height = '16px'
	btn.setAttribute('style', 'cursor: pointer;-moz-user-focus:');
	btn.setAttribute('src', self.data.url(badge_path_str));
	btn.onclick = handleIconClick;
	urlBarIcons.appendChild(btn);

}

/**
* Handle if we hit qouta ...
**/
storage.on("OverQuota", function(){

	// delete the cache of domains
	if(storage.storage[ CONSTANTS.DOMAINS_KEY ]) {

		// set to blank
		storage.storage[ CONSTANTS.DOMAINS_KEY ] = []

		// remove it
		delete storage.storage[ CONSTANTS.DOMAINS_KEY ];

	}

});

/**
* Checks if we should allow this url
**/
function allowUrlView(url_str) {

	// check the url
	if(!url_str) return false;

	// parse the url
	var url_obj = URI(url_str);

	// find the hostname
	var hostname_str = ( url_obj.hostname() ).toLowerCase();

	// handle it
	if( hostname_str.indexOf('localhost') === 0) return false;
	if( url_str.indexOf('chrome://') === 0) return false;
	if( hostname_str.indexOf('about:') !== -1) return false;

	// return a true !
	return true;

}

/**
* Handles receiving the tab which we would then show
**/
function handleTabEvent(tab) {

	// set the current tab then
	CURRENT_TAB = tab;

	// sanity check
	if(tab && tab.url && allowUrlView(tab.url)) {

		// cool so get the score
		getReportInfoByURL(tab.url, function(result) {

			// only if we still have the same tab
			if(CURRENT_TAB == tab) {

				if(result && (result.count || 0) > 0) {

					// output the counter icon
					showIcon(tab, result.score);

				} else {

					// show our blank icon ...
					showIcon(tab, null);

				}

			}

		});	

	}

}

/**
* Listen for new tabs
**/
tabs.on("onPageShow", handleTabEvent);
tabs.on("ready", handleTabEvent);

// show a install notice
installNotice();
