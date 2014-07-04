/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

var url = require('url'),
    $fh = require('fh-mbaas-api'),
    req = require('request');

var VERSION = "0.2.0";

exports.request = function(rurl, data, callback, exheaders, exoptions) {
    var curl = url.parse(rurl);
    var secure = curl.protocol == 'https:';
    var host = curl.hostname;
    var port = parseInt(curl.port || (secure ? 443 : 80));
    var path = [curl.pathname || '/', curl.search || '', curl.hash || ''].join('');
    var method = data ? "POST" : "GET";
    var headers = {
        "User-Agent": "node-soap/" + VERSION,
        "Accept" : "text/html,application/xhtml+xml,application/xml",
        "Accept-Encoding": "none",
        "Accept-Charset": "utf-8",
        "Connection": "close",
        "Host" : host
    };

    if (typeof data == 'string') {
        headers["Content-Length"] = Buffer.byteLength(data, 'utf8');
        headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    exheaders = exheaders || {};
    for (var attr in exheaders) { headers[attr] = exheaders[attr]; }

    var options = {
        uri: curl,
        method: method,
        headers: headers,
        timeout: 180000 // 3 mins
    };

    exoptions = exoptions || {};
    for (var attr in exoptions) { options[attr] = exoptions[attr]; }

    saveHttpRequestResponse(data, function(err, dbRes) {

        var cbExecuted = false;

        if (err) {
            console.error( 'Problem saving soap xml to DB *****' + err );
        } else {

            var request = req(options, function (error, res, body) {

                updateHttpRequestResponse ( dbRes.fields, dbRes.guid, error, body );
                if (!cbExecuted) {
                    cbExecuted = true;
                    if (error) {
                        callback(error);
                    } else {
                        callback(null, res, body);
                    }
                }
            });

            request.on('error', function (err) {
                console.error( 'Error thrown from node-soap request: '+err);
                if (!cbExecuted) {
                    cbExecuted = true;
                    callback(e);
                }
            });

            request.end(data);
        }
    });
}


function saveHttpRequestResponse ( data, cb ) {
    var datetime = +new Date(),
        wonum = getWoNum(data);

    $fh.db({
        act: "create",
        type: "woSoapXMLOut",
        fields: {
            before : datetime,
            source : 'http.js',
            request : data,
            wonum : wonum
        }
    }, cb );
}

function getWoNum (data) {
    var woNumRegex,
        woNum,
        woNumId = '';

    try {
        woNumRegex = /\<workOrderNo\>(.+?)\<\/workOrderNo\>/g;
        woNum = woNumRegex.exec( data );
        if (!woNum) {
            woNumRegex = /\<work_order\>(.+?)\<\/work_order\>/g;
            woNum = woNumRegex.exec( data );
        }
        if (woNum) {
            woNumId = woNum[1];
        }
    } catch (e) {
    }

    return woNumId;
}


function updateHttpRequestResponse ( fields, guid, error, body ) {

    fields.after = new Date().getTime();
    fields.resultBody = body;
    fields.error = error;

    $fh.db({
        act: "update",
        type: "woSoapXMLOut",
        guid: guid,
        fields: fields
    }, function(err, res) {
        if (err) {
            console.error( 'Problem updating soap xml to DB *****' + err );
        } else {
            // console.log( 'Saved soap xml data to db: ' );
        }
    });
}
