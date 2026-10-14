export default function assert(condition,message='Check failed'){if(!condition)throw new Error(message)}
assert.equal=(actual,expected,message='Values differ')=>assert(actual===expected,message);
