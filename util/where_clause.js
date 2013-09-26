define([], function(){
	var WhereClause = function WhereClause(){};

	WhereClause.prototype.or = function or (expression) {
		var self = this;

		self.$or = self.$or || [];
		self.$or = self.$or.concat(expression);
		return self;
	};

	WhereClause.prototype.and = function and (expression) {
		var self = this;

		self.$and = self.$and || [];
		self.$and = self.$and.concat(expression);
		return self;
	}

	return WhereClause;
});
