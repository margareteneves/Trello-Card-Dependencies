var TrelloDependencyEngine = function()
{

	var topMargin = 40;
	var selPrefix = 'DepView_';
	var trelloApiKey = '3cdc78472ff342a6bf17af374e1da7dd';
	var trelloTokenAvailable = new $.Deferred();

	var injectControls = function(token){
		this.setupHeader();
	};
	
	var setupHeader = function() {
		this.setupShowDependenciesButton();
	};
	
	var setupShowDependenciesButton = function(){
		var showHideButtonId = '#'+this.selPrefix+'ShowHideButton';
		if($(showHideButtonId).length > 0)
		{
			return;
		}
		
		var boardHeader = $('.board-header');
		// If they have the scrum extension insert the link before the settings icon
		var scrumSettingsLink = $('#scrumSettingsLink');
		
		if(scrumSettingsLink.length > 0)
		{
			scrumSettingsLink.before(this.buildShowLink());
		}
		else
		{
			boardHeader.append(this.buildShowLink());
		}
		
		$(showHideButtonId).click(showDependenciesButtonClick.bind(this));
		
		$('.js-open-board').click(function(){
			var frameId = this.selPrefix+'depFrame';
			$('#'+frameId).remove();
		}.bind(this));
	};
	
	var setupChildCommunication = function() {
		// Create IE + others compatible event handler
		var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
		var eventer = window[eventMethod];
		var messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";

		// Listen to message from child window
		eventer(messageEvent,function(e) {
			switch(e.data.type)
			{
				case 'addDependency':
				{
					this.addDependency(e.data);
				}break;
				
				case 'removeDependency':
				{
					this.removeDependency(e.data);
				}
			}
		}.bind(this),false);
		
	}
	
	var addDependency = function(e)
	{
		Trello.cards.get(e.dependent.shortLink).promise().done(function(r){
			var desc = r.desc;
			desc = desc + '\nDependsOn('+e.dependency.shortLink+')';
			Trello.put('cards/' + e.dependent.shortLink + '/desc',
					  {value:desc},function(res){console.log(res);})
					  .promise()
					  .done(function(r){					  
						  var frame = this.getDepFrame();
						  if(frame.length > 0)
						  {
							frame[0].contentWindow.postMessage({type: 'dependencyAdded', dependency : e.dependency, dependent : e.dependent},chrome.extension.getURL(''));
						  }
					  }.bind(this));
		}.bind(this));
	};
	
	var removeDependency = function(e)
	{
		Trello.cards.get(e.dependent.shortLink).promise().done(function(r){
			var desc = r.desc;
			desc = desc.replace('\nDependsOn('+e.dependency.shortLink+')','');
			Trello.put('cards/' + e.dependent.shortLink + '/desc',
					  {value:desc},function(res){console.log(res);})
					  .promise()
					  .done(function(r){					  
						  var frame = this.getDepFrame();
						  if(frame.length > 0)
						  {
							frame[0].contentWindow.postMessage({type: 'dependencyRemoved', dependency : e.dependency, dependent : e.dependent},chrome.extension.getURL(''));
						  }
					  }.bind(this));
		}.bind(this));
	}
	
	var buildShowLink = function(){
		var id = selPrefix + 'ShowHideButton';
		var iconUrl = chrome.extension.getURL("icon.png");
		return buildHeaderButton(id,iconUrl,'Show/Hide dependencies');
	};
	
	var buildHeaderButton = function(id,iconUrl,content){
		return $('<a id="'+id+'" class="board-header-btn"><span class="icon-sm board-header-btn-icon"><img src="'+iconUrl+'" width="12" height="12" /></span><span class="text board-header-btn-text">'+content+'</span></a>');
	};
	
	var showDependenciesButtonClick = function(){
		
		var token = Trello.token();

		if(token === undefined || token === null)
		{	
			Trello.authorize({type: 'popup',
					  name:'Trello Card Dependency',
					  persist : true,
					  scope: {read: true, write : true},
					  expiration: 'never',
					  success:function(){
						this.trelloToken = Trello.token();
						this.trelloTokenAvailable.resolve();
					  }.bind(this)
					 });
		}
		
		this.trelloTokenAvailable.done(function(){
			
			var frameId = this.selPrefix+'depFrame';
			if($('#'+frameId).length === 0 )
			{
				var boardUrl = window.location.pathname.match(/\/b\/(.+)\//)[1];
				var viewUrl = chrome.extension.getURL("index.html?boardShortLink="+boardUrl+"&trelloToken="+this.trelloToken);
				
				this.setupFrame(viewUrl);
			}
			else
			{
				$('#'+frameId).remove();
			}
		
		}.bind(this));	
		
	};
	
	var setupFrame = function(viewUrl) {
		var frameId = this.selPrefix+'depFrame';
		var frame = $('<iframe id="'+frameId+'"></iframe>');

		frame.attr('src',viewUrl);

		frame.css('position','absolute');
		frame.css('top', this.topMargin + 'px');
		frame.css('left','0');
		frame.width($(window).width());
		frame.css('height',$(window).height() + 'px');
		frame.css('border','none');

		$('.board-wrapper').append(frame);
		
		$(window).on('resize',function(){this.resizeframe(frame);}.bind(this));
		this.resizeframe(frame);
				
		this.passCurrentCardVisualisation();
			 
	}
	
	var resizeframe = function(frame){
		frame.width($(window).width());
		frame.height($(window).height() - this.topMargin);
	};
	
	var getDepFrame = function(){
		return $('#'+this.selPrefix+'depFrame');
	}
	
	var passCurrentCardVisualisation = function(){
		
		var frame = this.getDepFrame();
		if(frame.length > 0)
		{
			var cards = $('.list-card');
			
			var prepareCard = function(c){
				var card = $(c).clone();
				
				//card.find('.list-card-details').css('position','inherit');
				//card.find('.badge').css('position','inherit');
				//card.children().filter(function(i,e){return $(e).css('position') == 'relative';}).css('position','inherit')
				
				card.find('*').css('position','inherit');
				card.find('a').attr('href','#');
				card.css('position','inherit');
				card.find('.list-card-cover').css('-webkit-transform','none');
				
				return card;
			};
			
			var cardsHtml = Enumerable.From(cards).Select(function(c){return $('<p></p>').append(prepareCard(c)).html();}).ToArray();
			
			var sheets = Enumerable.From($('head').find('[rel="stylesheet"]')).Select(function(e){return $(e).attr('href');}).ToArray();

			frame[0].contentWindow.postMessage({type: 'css',links : sheets},'*');
			frame[0].contentWindow.postMessage({type: 'cards',cards : cardsHtml},'*');
		}
	};

	var waitForElementToDisplay = function(selector, time) {
        if($(selector).length) {
			console.log("waitForElementToDisplay");
			addDependencyButtonToCard(selector);
            return;
        }
        else {
            setTimeout(function() {
                waitForElementToDisplay(selector, time);
            }, time);
        }
	};

	var addDependencyButtonToCard = function (selector){
		console.log("addDependencyButtonToCard");
		$(selector).append('<a class="button-link js-link-card" href="#"><span class="icon-sm icon-archive"></span>&nbsp;Vincular</a>');
		var button = $(".button-link.js-link-card");
		$(".button-link.js-link-card").click(function(){
			if($(".pop-over.is-shown").length){
				hideDependencyWindow();
			}else{
				showDependencyWindow();
			}
		});
	};

	var showDependencyWindow = function(){
		if($(".pop-over.is-shown").length!=0) hideDependencyWindow();
		
		var button = $(".button-link.js-link-card");
		var leftPosition = button.offset().left;
		var topPosition  = button.offset().top + 40;
		console.log("addDependencyButtonToCard show");
		$(".pop-over").addClass("is-shown");
		$(".pop-over.is-shown").css({'left': leftPosition+'px', 'top': topPosition+'px'});
		$(".pop-over.is-shown").html('<div class="no-back"><div class="pop-over-header js-pop-over-header"><span class="pop-over-header-title">Vincular!</span><a href="#" id="closeDependencyPopUp" class="pop-over-header-close-btn icon-sm icon-close"></a></div><div><div class="pop-over-content js-pop-over-content u-fancy-scrollbar js-tab-parent" style="max-height: 886px;"><div><div><form><label for="id-checklist">Título</label><input id="id-checklist" class="js-checklist-title js-autofocus" type="text" value="Checklist" data-default="Checklist" dir="auto"><input class="primary wide confirm js-add-checklist" type="submit" value="Adicionar"></form></div></div></div></div></div>');
		$("#closeDependencyPopUp").click(function(){
			hideDependencyWindow();
		});
	};
	
	var hideDependencyWindow = function(){
		if($(".pop-over.is-shown").length==0) return;
		console.log("addDependencyButtonToCard hide");
		$(".pop-over.is-shown").removeClass("is-shown");
		$(".pop-over").html("");
		
	};

	return { 
			 topMargin : topMargin,
			 selPrefix : selPrefix,
	
			 injectControls : injectControls,
			 setupHeader : setupHeader,
			 buildShowLink : buildShowLink,
			 setupFrame : setupFrame,
			 resizeframe : resizeframe,
			 setupChildCommunication : setupChildCommunication,
			 passCurrentCardVisualisation : passCurrentCardVisualisation,
			 setupShowDependenciesButton : setupShowDependenciesButton,
			 trelloTokenAvailable : trelloTokenAvailable,
			 addDependency : addDependency,
			 getDepFrame : getDepFrame,
			 removeDependency : removeDependency,
			 waitForElementToDisplay : waitForElementToDisplay,
			 addDependencyButtonToCard:addDependencyButtonToCard,
			 showDependencyWindow: showDependencyWindow,
			 hideDependencyWindow: hideDependencyWindow
			};	
};

$(function(){

	var engine = new TrelloDependencyEngine();	

	engine.setupChildCommunication();

	var appLoop = function(){
		engine.injectControls();
	};
	console.log("onload");
	setInterval(engine.passCurrentCardVisualisation.bind(engine), 1000);
	setInterval(appLoop, 500);
	$(".list-card.js-member-droppable.ui-droppable").click(function(){
		console.log("onclick");
		engine.waitForElementToDisplay(".window-module.other-actions.u-clearfix .u-clearfix");
	});

});







 //chrome.extension.getURL("index.html")
//chrome.tabs.create({ url:"about:blank" });