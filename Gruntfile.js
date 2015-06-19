'use strict';
module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        jshint: {
            all: ['*.js', 'controllers/*.js', 'middlewares/*.js'], options: {
                jshintrc: true
            }
        }, jsdoc: {
            dist: {
                src: ['./*.js', './middlewares/*.js', './controllers/*.js'],
                jsdoc: './node_modules/.bin/jsdoc',
                options: {
                    destination: 'doc', configure: './jsdoc-conf.json'
                }
            }
        }, mochaTest: {
            unit: {
                options: {
                    reporter: 'spec', captureFile: 'unit-tests-results.txt'
                }, src: ['tests/unit/**/*.js']
            }, system: {
                options: {
                    reporter: 'spec', captureFile: 'system-tests-results.txt'
                }, src: ['tests/system/**/*.js']
            }, rest: {
                options: {
                    reporter: 'spec', captureFile: 'rest-tests-results.txt'
                }, src: ['tests/rest/**/*.js']
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-jsdoc');

    grunt.registerTask('unit', ['mochaTest:unit']);
    grunt.registerTask('system', ['mochaTest:system']);
    grunt.registerTask('rest', ['mochaTest:rest']);
};
