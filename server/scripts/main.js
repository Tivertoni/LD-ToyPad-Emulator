let characters;
let vehicles;

const socket = io();

$(function () {
  // Pre-load character and vehicle data, since it is required for the operation of the page and there are multiple places it is used
  $.ajax({
    dataType: "json",
    url: "json/charactermap.json",
    async: false,
    success: function (data) {
      characters = data;
    },
  });

  $.ajax({
    dataType: "json",
    url: "json/tokenmap.json",
    async: false,
    success: function (data) {
      vehicles = data;
    },
  });

  setupFilterInputs();

  socket.emit("connectionStatus");
  socket.emit("syncToyPad");

  const currentMousePos = { x: -1, y: -1 };
  $(document).mousemove(function (event) {
    currentMousePos.x = event.pageX;
    currentMousePos.y = event.pageY;
  });

  //**Drag & Drop Functions**
  $("#remove-tokens").sortable({
    cancel: ".drag-disabled",
  });

  $(".box").sortable({
    connectWith: ".box",
    scroll: true,
    scrollSensitivity: 40,
    scrollSpeed: 10,

    helper: "clone",
    appendTo: document.getElementById("focus"),
    containment: document.getElementById("focus"),

    sort: function (event, ui) {
      ui.helper[0].style.left = currentMousePos.x - 20;
      ui.helper.css({ "list-style-type": "none" });
    },

    start: function (event, ui) {
      $("html, body").animate({ scrollTop: $(document).height() }, 500);

      // Store the starting pad number and index so we can determine when releasing the tag if it was released in the same space
      ui.item.attr("previous-pad-num", ui.item.closest(".box").attr("pad-num"));
      ui.item.attr(
        "previousPadIndex",
        ui.item.closest(".box").attr("pad-index")
      );
    },

    stop: function (event, ui) {
      const parentBox = ui.item.closest(".box");
      const previousPadNum = Number.parseInt(ui.item.attr("previous-pad-num"));
      const newPadNum = Number.parseInt(parentBox.attr("pad-num"));
      const previousPadIndex = Number.parseInt(ui.item.attr("previousPadIndex"));
      const newPadIndex = Number.parseInt(parentBox.attr("pad-index"));

      // If moving to the same space on the Toy Pad, remove and place in the current space
      if (
        previousPadNum != -1 &&
        previousPadNum != -2 &&
        previousPadNum == newPadNum &&
        previousPadIndex == newPadIndex
      ) {
        updateToyPadPosition(
          ui.item.attr("data-uid"),
          Number.parseInt(ui.item.attr("data-id")),
          newPadNum,
          newPadIndex,
          newPadIndex
        );
      }

      ui.item.removeAttr("previous-pad-num");
      ui.item.removeAttr("previousPadIndex");

      applyFilters(); //Refilter in case anything was in the search bar.
    },
    receive: function (event, ui) {
      const $this = $(this);

      if ($this.attr("id") == "remove-tokens") {
        socket.emit("deleteToken", ui.item.attr("data-uid"));
        setTimeout(function () {
          refreshToyBox();
        }, 500);
      }
      else if (
        $this.attr("pad-num") == undefined ||
        ($this.children("li").length > 1 && $this.attr("id") != "toybox-tokens")
      )
        $(ui.sender).sortable("cancel");
      //If moving to the Toy Pox, remove tag from the game.
      else if ($this.attr("id") == "toybox-tokens") {
        $.ajax({
          method: "DELETE",
          contentType: "application/json",
          url: "/remove",
          data: JSON.stringify({
            index: Number.parseInt(ui.sender.attr("pad-index")),
            uid: ui.item.attr("data-uid"),
          }),
        });
      }
      //If moving from the Toy Box, place tag in the game.
      else if (Number.parseInt(ui.sender.attr("pad-num")) === -1) {
        const content = {
          uid: ui.item.attr("data-uid"),
          id: Number.parseInt(ui.item.attr("data-id")),
          position: Number.parseInt($this.attr("pad-num")),
          index: Number.parseInt($this.attr("pad-index")),
        };
        console.log(content);
        $.ajax({
          method: "POST",
          contentType: "application/json",
          url: "/place",
          data: JSON.stringify(content),
        });
      }
      //If moving between spaces on the Toy Pad, remove from previous space and place in new one.
      else {
        updateToyPadPosition(
          ui.item.attr("data-uid"),
          Number.parseInt(ui.item.attr("data-id")),
          Number.parseInt($this.attr("pad-num")),
          Number.parseInt(ui.sender.attr("pad-index")),
          Number.parseInt($this.attr("pad-index"))
        );
      }
    },
  });

  $(".box").disableSelection();

  //When there is a change in the search bar
  $("#name-filter").on("input", function (e) {
    applyFilters();
  });
  //**IO Functions**
  socket.on("refreshTokens", function () {
    console.log("IO Recieved: Refresh Tokens");
    setTimeout(function () {
      refreshToyBox();
    }, 1000);
  });

  socket.on("Fade One", function (e) {
    console.log("IO Recieved: Fade One");
    const padindexs = [[2], [1, 4, 5], [3, 6, 7]];
    const pad = e[0];
    const speed = e[1];
    const cycles = e[2];
    const color = e[3] + "80";
    console.log("FADE ONE: ", e);
    const pads = padindexs[pad - 1];
    pads.forEach((element) => {
      const padElement = document.getElementById("toypad" + element);

      console.log("#toypad" + element + " Color: " + color);
      $("#toypad" + element)
        .animate()
        .css({ backgroundColor: color });
      setTimeout(() => {
        $("#toypad" + element)
          .animate()
          .css({ backgroundColor: padElement.color });
      }, speed * 100);
    });
  });

  socket.on("Fade All", function (e) {
    console.log("IO Recieved: Fade All");
    const padindexs = [1, 2, 3, 4, 5, 6, 7];
    const speed = e[0];
    const cycles = e[1];
    padindexs.forEach((element) => {
      const pad = document.getElementById("toypad" + element);
      let color;

      if (element == 2) color = e[2];
      else if (element == 1 || element == 4 || element == 5) color = e[5];
      else if (element == 3 || element == 6 || element == 7) color = e[8];
      console.log("#toypad" + element + " Color: " + color);
      color = color + "80";
      $("#toypad" + element)
        .animate()
        .css({ backgroundColor: color });
      setTimeout(() => {
        $("#toypad" + element)
          .animate()
          .css({ backgroundColor: pad.color });
      }, speed * 100);
    });
  });

  socket.on("Color One", function (e) {
    console.log("IO Recieved: Color One");
    const padindexs = [[2], [1, 4, 5], [3, 6, 7]];
    const pad = e[0];
    const color = e[1] + "80";
    console.log(color);
    const pads = padindexs[pad - 1];
    pads.forEach((element) => {
      const padElement = document.getElementById("toypad" + element);
      padElement.setAttribute("color", e[1]);
      $("#toypad" + element).css({ backgroundColor: color });
    });
  });

  socket.on("Color All", function (e) {
    console.log("IO Recieved: Color All");
    const padindexs = [1, 2, 3, 4, 5, 6, 7];
    padindexs.forEach((element) => {
      const pad = document.getElementById("toypad" + element);

      let color;

      if (element == 2) color = e[0];
      else if (element == 1 || element == 4 || element == 5) color = e[1];
      else if (element == 3 || element == 6 || element == 7) color = e[2];
      pad.setAttribute("color", color);
      console.log(pad);
      color = color + "80";
      $("#toypad" + element).css({ backgroundColor: color });
    });
  });

  socket.on("Connection True", function (e) {
    console.log("Connection Success Recieved");
    $("#status").css({ display: "none" });
  });

  $("#character-select").submit(function (e) {
    e.preventDefault();

    const name = $("#character-name").val();
    $.ajax({
      method: "POST",
      contentType: "application/json",
      url: "/character",
      data: JSON.stringify({ id: filterByName(characters, name).id }),
    }).done(function () {
      setTimeout(() => 
      {
        socket.emit("syncToyPad");
        $("#character-select")[0].reset();  
      }, 150);
    });
  });

  $("#vehicle-select").submit(function (e) {
    e.preventDefault();

    const name = $("#vehicle-name").val();
    console.log(name);
    const id = filterByName(vehicles, name).id;
    $.ajax({
      method: "POST",
      contentType: "application/json",
      url: "/vehicle",
      data: JSON.stringify({ id: id }),
    }).done(function () {
      setTimeout(() => 
      {
        socket.emit("syncToyPad");
        $("#vehicle-select")[0].reset();   
      }, 150);
    });
  });

  $("#sync").click(function () {
    socket.emit("syncToyPad");
  });

  //**Customize Token**
  const dialog = $("#dialog-form").dialog({
    autoOpen: false,
    height: 400,
    width: 350,
    modal: true,
    buttons: {
      Cancel: function () {
        dialog.dialog("close");
      },
    },
    close: function () {
      form[0].reset();
      allFields.removeClass("ui-state-error");
    },
  });

  $(".item").click(function () {
    console.log("click! " + $(this).attr("id"));
    dialog.dialog("open");
  });

  $(".filter-input").change(function () {
    applyFilters();
  });

  $("#tag-world-filter").click(function () {
    $("#tag-world-filter").val("");
    applyFilters();
  });

  $("#tag-ability-filter").click(function () {
    $("#tag-ability-filter").val("");
    applyFilters();
  });

  $("#clear-filters").click(function () {
    clearFilterInputs();
    clearFilters();
  });
});

//**Script Functions**

function filterById(jsonObject, id) {
	return jsonObject.find(function(jsonObject) {
		return jsonObject["id"] == id;
	});
}

function filterByName(jsonObject, name) {
	return jsonObject.find(function(jsonObject) {
		return jsonObject["name"] == name;
	});
}

//Remove all token items from the lists and reread toytags.json and repopulate the lists.
function refreshToyBox() {
	//Remove All Current Tokens
	const boxes = document.querySelectorAll(".box");

	boxes.forEach(function(toybox) {
		while (
			toybox.lastChild &&
			toybox.lastChild.id != "deleteToken" &&
			toybox.lastChild.id != "colorToken"
		) {
			toybox.lastChild.remove();
		}
	});

	//Reread JSON file
	$.getJSON("./json/toytags.json", function(data) {
    $.each(data, function(i, item) {
			console.log("ID: " + item.id + " UID: " + item.uid);
			if (item.name != "N/A" && item.index == "-1") {
				$("#toybox-tokens").append(createItemHtml(item));
			} else if (item.index != "-1") {
				$("#toypad" + item.index).append(createItemHtml(item));
			}
			applyFilters();
		});
	});
}

function createItemHtml(item) {
	let itemData;

	if (item.type == "character") {
		itemData = filterById(characters, item.id);
	} else {
		itemData = filterById(vehicles, item.id);
	}

	let content = "<h3>" + itemData.name + "</h3>";
	const path = "images/" + itemData.id + ".png";
	const url = $(location).attr("href") + "/../" + path;

	if (fileExists(url)) {
		content =
			"<img src=" +
			path +
			" alt=" +
			itemData.name +
			" style='width: 100%; height: 100%; object-fit: contain; pointer-events: none;'>";
	}

	return (
		"<li class=item draggable=true data-name=" +
		item.name +
		" data-type=" +
		item.type +
		" data-id= " +
		item.id +
		" data-uid=" +
		item.uid +
		" pad=" +
		item.pad +
		' data-world="' +
		itemData.world +
		'" data-abilities="' +
		itemData.abilities +
		'">' +
		content +
		"</li>"
	);
}

function fileExists(url) {
	const http = new XMLHttpRequest();
	http.open("HEAD", url, false);
	http.send();
	return http.status != 404;
}

function updateToyPadPosition(uid, id, position, currentIndex, newIndex) {
	console.log(currentIndex);
	$.ajax({
		method: "DELETE",
		contentType: "application/json",
		url: "/remove",
		data: JSON.stringify({
			index: currentIndex,
			uid: uid
		}),
	}).done(function() {
		setTimeout(function() {
			$.ajax({
				method: "POST",
				contentType: "application/json",
				url: "/place",
				data: JSON.stringify({
					uid: uid,
					id: id,
					position: position,
					index: newIndex,
				}),
			});
		}, 500);
	});
}

//Filter the toybox to tags matching the current text of the search bar.
function applyNameFilter() {
	const text = $("#name-filter").val().toLowerCase();
	$(".item").each(function(index, item) {
		const name = $(item).text().toLowerCase();
		if (!name.includes(text)) {
			$(item).addClass("filtered");
		}
	});
}

function setupFilterInputs() {
	$.each(characters, function(i, item) {
		if (item.name != "Unknown" || item.name.includes("(unreleased)"))
			$("#character-list").append(
				'<option value="' +
				item.name +
				'" data-world="' +
				item.world +
				'" data-abilities="' +
				item.abilities +
				'">'
			);
	});

	$.each(vehicles, function(i, item) {
		if (item.name != "Unknown")
			$("#vehicle-list").append(
				'<option value="' +
				item.name +
				'" data-world="' +
				item.world +
				'" data-abilities="' +
				item.abilities +
				'">'
			);
	});

	let worlds = [];
	const ignoredWorlds = new Set(["15", "16", "17", "18", "19", "20", "N/A", "Unknown"]);
	worlds = worlds.concat(
		characters.map(function(character) {
			return character.world;
		})
	);
	worlds = worlds.concat(
		vehicles.map(function(vehicle) {
			return vehicle.world;
		})
	);
	worlds = getUniqueSortedValues(worlds);
	worlds = worlds.filter(function(world) {
		return !ignoredWorlds.has(world);
	});

	$.each(worlds, function(i, world) {
		if (world != "Unknown")
			$("#world-list").append('<option value="' + world + '">');
	});

	let abilities = [];
	abilities = abilities.concat(
		characters.map(function(character) {
			return character.abilities.split(",");
		})
	);
	abilities = abilities.concat(
		vehicles.map(function(vehicle) {
			return vehicle.abilities.split(",");
		})
	);
	abilities = abilities.flat();
	abilities = getUniqueSortedValues(abilities);

	$.each(abilities, function(i, ability) {
		if (ability != "Unknown")
			$("#ability-list").append('<option value="' + ability + '">');
	});
}

function applyFilters() {
	clearFilters();
	applyNameFilter();
	applyWorldFilter();
	applyAbilityFilter();
}

function applyWorldFilter() {
	const world = $("#tag-world-filter").val();
	if (world != "") {
		$("#character-list option, #vehicle-list option").each(function(
			index,
			option
		) {
			if ($(option).attr("data-world") != world) {
				$(option).prop("disabled", true);
			}
		});

		$(".item").each(function(index, item) {
			if ($(item).attr("data-world") != world) {
				$(item).addClass("filtered");
			}
		});
	}
}

function applyAbilityFilter() {
	const ability = $("#tag-ability-filter").val();
	if (ability != "") {
		$("#character-list option, #vehicle-list option").each(function(
			index,
			option
		) {
			if (!$(option).attr("data-abilities").split(",").includes(ability)) {
				$(option).prop("disabled", true);
			}
		});

		$(".item:not(#deleteToken)").each(function(index, item) {
			if (!$(item).attr("data-abilities").split(",").includes(ability)) {
				$(item).addClass("filtered");
			}
		});
	}
}

function clearFilterInputs() {
	$("#tag-world-filter, #tag-ability-filter, #name-filter").val("");
}

function clearFilters() {
	$("#character-list option, #vehicle-list option").prop("disabled", false);
	$(".item").removeClass("filtered");
}

function getUniqueSortedValues(array) {
	return array
		.filter(function(value, index, self) {
			return self.indexOf(value) === index;
		})
		.sort(compareWithoutArticles);
}

function compareWithoutArticles(a, b) {
	const aWithoutArticles = removeArticles(a);
	const bWithoutArticles = removeArticles(b);

	if (aWithoutArticles > bWithoutArticles) {
		return 1;
	}

	if (aWithoutArticles < bWithoutArticles) {
		return -1;
	}

	return 0;
}

function removeArticles(string) {
	const words = string.split(" ");
	if (words.length <= 1) {
		return string;
	}

	if (words[0] == "The") {
		return words.splice(1).join(" ");
	}

	return string;
}