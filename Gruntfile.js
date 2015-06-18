"use strict";
module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        jsdoc: {
            dist: {
                src: ['./*.js', './middlewares/*.js', './controllers/*.js'],
                jsdoc: './node_modules/.bin/jsdoc',
                options: {
                    destination: 'doc', configure: './jsdoc-conf.json'
                }
            }
        }, jshint: {
            all: ['*.js', 'controllers/*.js', 'middlewares/*.js'],
            options: {
                jshintrc: true
            }
        }
    });

    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.loadNpmTasks('grunt-contrib-jshint');
};
