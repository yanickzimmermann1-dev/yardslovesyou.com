/* work.js - Work page: fills #work-grid from portfolio.js */
document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('work-grid');
  if (el && window.YLYPortfolio) window.YLYPortfolio.renderGrid(el, {});
});
