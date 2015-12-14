var _ = require('lodash'),
    util = require('./util.js');

var request = require('request').defaults({
    baseUrl: 'https://api.bitbucket.org/2.0/'
});

var globalPickResult = {
    '-': {
        keyName: 'values',
        fields: {
            'html': 'links.html.href',
            'date': 'date',
            'message': 'message',
            'repository': 'repository.name',
            'author_name': 'author.user.username',
            'author_display_name': 'author.user.display_name'
        }
    }
};

var pickInputs = ['branchortag', 'include', 'exclude'];

module.exports = {

    authParams: function (dexter) {
        var auth = {},
            username = dexter.environment('bitbucket_username'),
            password = dexter.environment('bitbucket_password');

        if (username && password) {

            auth.user = username;
            auth.pass = password;
        }

        return _.isEmpty(auth)? false : auth;
    },

    /**
     * Send api request.
     *
     * @param method
     * @param api
     * @param options
     * @param auth
     * @param callback
     */
    apiRequest: function (method, api, options, auth, callback) {

        request[method]({url: api, qs: options, auth: auth, json: true}, callback);
    },

    inputAttr: function (step) {
        var data = {};

        pickInputs.forEach(function (attrName) {

            if (step.input(attrName).first() !== null)
                data[attrName] = step.input(attrName).first()
        });

        if (data.is_private)
            data.is_private = _(data.is_private).toString().toLowerCase() === 'true';

        return data;
    },

    processResult: function (error, responce, body) {

        if (error)

            this.fail(error);

        else if (responce && !body)

            this.fail(responce.statusCode + ': Something is happened');

        else if (responce && body.error)

            this.fail(responce.statusCode + ': ' + JSON.stringify(body.error));

        else

            this.complete(util.pickResult(body, globalPickResult));

    },

    checkCorrectParams: function (auth, step) {
        var result = true;

        if (!auth) {

            result = false;
            this.fail('A [bitbucket_username, bitbucket_password] environment need for this module.');
        }

        if (!step.input('owner').first() || !step.input('repo_slug').first()) {

            result = false;
            this.fail('A [owner, repo_slug] inputs need for this module.');
        }

        return result;
    },

    /**
     * The main entry point for the Dexter module
     *
     * @param {AppStep} step Accessor for the configuration for the step using this module.  Use step.input('{key}') to retrieve input data.
     * @param {AppData} dexter Container for all data used in this workflow.
     */
    run: function(step, dexter) {

        var auth = this.authParams(dexter);
        // check params.
        if (!this.checkCorrectParams(auth, step)) return;

        var inputAttr = this.inputAttr(step),
            owner = step.input('owner').first().trim(),
            repo_slug = step.input('repo_slug').first().trim();

        //send API request
        this.apiRequest('get', 'repositories/' + owner + '/' + repo_slug + '/commits', inputAttr, auth, function (error, responce, body) {

            this.processResult(error, responce, body);
        }.bind(this));
    }
};
