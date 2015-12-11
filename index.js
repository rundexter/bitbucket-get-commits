var _ = require('lodash');

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

    /**
     * Return pick result.
     *
     * @param output
     * @param pickTemplate
     * @returns {*}
     */
    pickResult: function (output, pickTemplate) {
        var result = _.isArray(pickTemplate)? [] : {};
        // map template keys
        _.map(pickTemplate, function (templateValue, templateKey) {

            var outputValueByKey = _.get(output, templateValue.keyName || templateValue, undefined);

            if (_.isUndefined(outputValueByKey)) {

                result = _.isEmpty(result)? undefined : result;
                return;
            } else if (_.isUndefined(result)) {

                result = _.isArray(pickTemplate)? [] : {};
            }

            // if template key is object - transform, else just save
            if (_.isArray(pickTemplate)) {

                result = outputValueByKey;
            } else if (_.isObject(templateValue)) {
                // if data is array - map and transform, else once transform
                if (_.isArray(outputValueByKey)) {
                    var mapPickArrays = this._mapPickArrays(outputValueByKey, templateKey, templateValue);

                    result = _.isEmpty(result)? mapPickArrays : _.merge(result, mapPickArrays);
                } else {

                    result[templateKey] = this.pickResult(outputValueByKey, templateValue.fields);
                }
            } else {

                _.set(result, templateKey, outputValueByKey);
            }
        }, this);

        return result;
    },

    /**
     * System func for pickResult.
     *
     * @param mapValue
     * @param templateKey
     * @param templateObject
     * @returns {*}
     * @private
     */
    _mapPickArrays: function (mapValue, templateKey, templateObject) {
        var arrayResult = [],
            result = templateKey === '-'? [] : {};

        _.map(mapValue, function (inOutArrayValue) {
            var pickValue = this.pickResult(inOutArrayValue, templateObject.fields);

            if (pickValue !== undefined)
                arrayResult.push(pickValue);
        }, this);

        if (templateKey === '-') {

            result = arrayResult;
        } else {

            result[templateKey] = arrayResult;
        }

        return result;
    },

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

            this.complete(this.pickResult(body, globalPickResult));

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

        var auth = this.authParams(dexter),
            inputAttr = this.inputAttr(step),
            owner = step.input('owner').first(),
            repo_slug = step.input('repo_slug').first();

        // check params.
        if (!this.checkCorrectParams(auth, step)) return;
        //send API request
        this.apiRequest('get', 'repositories/' + owner + '/' + repo_slug + '/commits', inputAttr, auth, function (error, responce, body) {

            this.processResult(error, responce, body);
        }.bind(this));
    }
};
