module.exports = {
	notify: function(event) {
		console.log(JSON.stringify(event.event, null, 4));
	}
};
