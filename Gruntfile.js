module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        jsdoc: {
            dist: {
                src: ['./*.js', './middlewares/*.js', './controllers/*.js'], jsdoc: './node_modules/.bin/jsdoc', options: {
                    destination: 'doc', configure: './jsdoc-conf.json'
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-jsdoc');

};
