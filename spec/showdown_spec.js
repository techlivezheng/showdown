describe("Showdown", function() {
  var render = function(str) {
    var showdown = new Showdown.converter();
    return showdown.makeHtml(str);
  };

  $(['simple.html']).each(function(){
    var that = this;

    it('should render ' + this + ' as expected', function(){
      loadFixtures(that);
      var node = document.getElementById(that);

      var source = $(node).find('code').html();
      var actual = render(source);
      var expected = $(node).find('.expected').html();

      expect(actual).toEqual(expected);
    });
  })
});
