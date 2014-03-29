module.exports = {
  script: 'echo Hello Audrey',
  requirements: {
    linux: [
      { type: 'js', input: "require('os').type()", match: /linux/i }
    ],
    win: [
      { type: 'js', input: "require('os').type()", match: /windows/i }
    ]
  },
  matrix: [
    { requirements: ['win'] },
    { requirements: ['linux'] }
  ]
};