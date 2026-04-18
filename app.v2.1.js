var ScormGet = undefined;
var ScormSet = undefined;
var date = new Date();
var nowStr =
  date.getFullYear() +
  "." +
  String(date.getMonth() + 1).padStart(2, "0") +
  "." +
  String(date.getDate()).padStart(2, "0") +
  " " +
  String(date.getHours()).padStart(2, "0") +
  ":" +
  String(date.getMinutes()).padStart(2, "0");
if (
  !location.href.endsWith("/shared/index") &&
  !location.href.includes("localhost:")
) {
  try {
    ScormProcessInitialize();
  } catch (e) {
    console.warn(e);
  }
  ScormGet = ScormProcessGetValue;
  ScormSet = function (a, b) {
    console.log("ScormSet! ", a, b);
    ScormProcessSetValue(a, b);
  };
} else {
  var prefix = "scorm_" + $("#root").attr("data-code") + "_";
  ScormGet = function (key) {
    return localStorage.getItem(prefix + key);
  };
  ScormSet = function (key, value) {
    localStorage.setItem(prefix + key, value);
  };
}

var base = JSON.parse($("#res_data").val());
var extraResData = JSON.parse(ScormGet("cmi.launch_data") || "{}");
for (var k of Object.keys(extraResData)) {
  base[k] = extraResData[k];
}

var moduleExtra = JSON.parse(ScormGet("cmi.suspend_data") || "{}");
var uname = ScormGet("cmi.learner_name");

var pageIds = [];
var moduleIds = [];

var process = [];
var queues = [];
var isQueue = false;

var swiper = undefined;
var isSwipe = false;
var autoPlay = undefined;

const NOT_ALLOWED_NEXT_MSG = "이전 학습 완료 후 학습이 가능합니다.";

var _c = $("#details").val();
$.ajax("./launch_view.html", {
  method: _c ? "POST" : "GET",
  data: _c,
  dataType: "html",
  contentType: "application/json; charset=utf-8",
  success: function (a) {
    $("#root").html(a);
    $("#root")
      .find("[src^='https://d1vdu6u8ovnv72.cloudfront.net']")
      .each(function (index, item) {
        var src = $(this).attr("src");
        src = src.replace("https://d1vdu6u8ovnv72.cloudfront.net", "");
        $(this).attr("src", src);
      });
    $("#root")
      .find("[data-src^='https://d1vdu6u8ovnv72.cloudfront.net']")
      .each(function (index, item) {
        var dataSrc = $(this).attr("data-src");
        dataSrc = dataSrc.replace("https://d1vdu6u8ovnv72.cloudfront.net", "");
        $(this).attr("data-src", dataSrc);
      });
    $("#root")
      .find("[src^='https://drqh6545bixgo.cloudfront.net']")
      .each(function (index, item) {
        var src = $(this).attr("src");
        src = src.replace("https://drqh6545bixgo.cloudfront.net", "");
        $(this).attr("src", src);
      });
    $("#root")
      .find("[data-src^='https://drqh6545bixgo.cloudfront.net']")
      .each(function (index, item) {
        var dataSrc = $(this).attr("data-src");
        dataSrc = dataSrc.replace("https://drqh6545bixgo.cloudfront.net", "");
        $(this).attr("data-src", dataSrc);
      });
    $("#root")
      .find("[src^='https://sra-dev.spharosacademy.com']")
      .each(function (index, item) {
        var dataSrc = $(this).attr("src");
        dataSrc = dataSrc.replace("https://sra-dev.spharosacademy.com", "");
        $(this).attr("src", dataSrc);
      });
    $("#root")
      .find("[data-src^='https://sra-dev.spharosacademy.com']")
      .each(function (index, item) {
        var dataSrc = $(this).attr("data-src");
        dataSrc = dataSrc.replace("https://sra-dev.spharosacademy.com", "");
        $(this).attr("data-src", dataSrc);
      });
    $("#root")
      .find("[src^='https://sra.spharosacademy.com']")
      .each(function (index, item) {
        var dataSrc = $(this).attr("src");
        dataSrc = dataSrc.replace("https://sra.spharosacademy.com", "");
        $(this).attr("src", dataSrc);
      });
    $("#root")
      .find("[data-src^='https://sra.spharosacademy.com']")
      .each(function (index, item) {
        var dataSrc = $(this).attr("data-src");
        dataSrc = dataSrc.replace("https://sra.spharosacademy.com", "");
        $(this).attr("data-src", dataSrc);
      });

    $("video").each(function () {
      $(this)
        .find("source")
        .each(function () {
          if ($(this).attr("src")) {
            $(this).attr(
              "src",
              $(this).attr("src") + "?t=" + new Date().getTime(),
            );
          }

          if ($(this).attr("data-src")) {
            $(this).attr(
              "data-src",
              $(this).attr("data-src") + "?t=" + new Date().getTime(),
            );
          }
        });
    });

    page_initialize();
  },
});

var isPrevParents = false;
var isNextParents = false;
try {
  isNextParents = !!window.parent && !!window.parent.nextChangeOnLesson;
  isPrevParents = !!window.parent && !!window.parent.prevChangeONLesson;
} catch (ex) {}

const requestFullScreen = () => {
  if (document.documentElement.requestFullscreen)
    return document.documentElement.requestFullscreen();
  else if (document.documentElement.webkitRequestFullscreen)
    return document.documentElement.webkitRequestFullscreen();
  else if (document.documentElement.mozRequestFullScreen)
    return document.documentElement.mozRequestFullScreen();
  else if (document.documentElement.msRequestFullscreen)
    return document.documentElement.msRequestFullscreen();
  else {
    try {
      return window.parent.toggleMobileFullscreen();
    } catch (e) {
      window.parent.postMessage("toggleMobileFullscreen");
    }
  }
};

const exitFullScrren = () => {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitCancelFullscreen) return document.webkitCancelFullscreen();
  if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
  if (document.msExitFullscreen) return document.msExitFullscreen();
};

const handleResize = () => {
  if (!document.fullscreenElement) {
    $(".fullscreen-el").removeClass("fullscreen-el");
    $("#root").removeClass("menu-hide");
  }
};
window.addEventListener("resize", handleResize);

const allowFullscreen = () => {
  return !!(
    document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen ||
    document.documentElement.mozRequestFullScreen ||
    document.documentElement.msRequestFullscreen
  );
};

var html_intfs = {};

$(window).on("message onmessage", function (e) {
  var data = e.originalEvent.data; // Should work.
  if (data.startsWith("$DOC_SIGHT$")) {
    var json = data.substring(11);
    var raw = JSON.parse(json);
    if (raw.action === "fullscreen") {
      if (document.fullscreenElement) {
        exitFullScrren();
      } else {
        $("[data-extra='" + raw.extra + "']").addClass("fullscreen-el");
        $("#root").addClass("menu-hide");
        requestFullScreen();
      }
    } else {
      var mid = $("iframe[data-extra='" + raw.extra + "']")
        .parents("[data-mod-id]")
        .attr("data-mod-id");
      if (raw.count > 0) {
        var process = Math.min(1, (raw.active + 1) / raw.count);
        window.setModuleExtra(mid, { process });
      }
    }
  } else {
    var uuid = data.substring(0, data.indexOf("/"));
    var val = parseInt(data.substring(data.indexOf("/") + 1), 10);
    window["fn_" + uuid](val);
  }
});

function page_initialize() {
  var screenBody = $("#screen_body");
  var pageIdItems = $("[data-page-id]");
  var menus = $(".index-list [data-page-id]");

  $("[data-html-src]").each(function (i, el) {
    var uuid = crypto.randomUUID();
    while (html_intfs[uuid]) {
      uuid = crypto.randomUUID();
    }

    var mid = $(this).parents("[data-mod-id]").attr("data-mod-id");
    window["fn_" + uuid] = function (progress) {
      window.setModuleExtra(mid, { process: Math.min(progress / 100.0, 1) });
    };
    html_intfs[uuid] = window["fn_" + uuid];

    $(this).attr("src", $(this).attr("data-html-src") + "?name=" + uuid);
  });

  if (base.menuHidden) {
    $("#screen_menu").hide();
    $("#root").addClass("menu-off");
  }

  $("#screen_body [data-page-id]").each(function (i, v) {
    var mods = [];
    $(v)
      .find("[data-mod-id]")
      .each((ix, el) => {
        var mid = $(el).attr("data-mod-id");
        var isAct = $(el).find(
          "video,audio,.module-slide.active,.module-quiz,[data-html-src],[data-extra]",
        ).length;
        mods.push(mid);
        if (!moduleExtra[mid]) {
          moduleExtra[mid] = { act: !!isAct, process: 0 };
        }
      });

    pageIds.push($(v).attr("data-page-id"));
    moduleIds.push(mods);
  });

  try {
    for (let i = 0; i < moduleIds.length; i++) {
      let sum = 0;
      for (let j = 0; j < moduleIds[i].length; j++) {
        let moduleData = moduleExtra[moduleIds[i][j]];
        sum += moduleData.process || 0;
      }

      process[i] = sum / moduleIds[i].length;
    }

    let max = menus.length;
    let rate = 0;
    for (let i = 0; i < max; i++) {
      rate += process[i] || 0;
    }

    let finalRate = rate / (max + 0.0);
    ScormSet("cmi.progress_measure", finalRate);
  } catch (e) {
    console.error(e);
  }

  screenBody
    .mouseenter(function () {
      $(this).addClass("nav-on");
    })
    .mouseleave(function () {
      $(this).removeClass("nav-on");
    });

  function setModuleExtra(mid, val) {
    const lastModuleId = $("[data-page-id='" + pageIndex + "'] [data-mod-id]")
      .last()
      ?.attr("data-mod-id");

    if (lastModuleId != mid && moduleExtra[mid]?.process === val?.process) {
      return;
    }

    if (moduleExtra[mid]) {
      moduleExtra[mid] = {
        ...moduleExtra[mid],
        ...val,
        process: !val.process
          ? moduleExtra[mid].process || 0
          : Math.max(moduleExtra[mid].process, val.process),
      };
    }
    ScormSet("cmi.suspend_data", JSON.stringify(moduleExtra));
    renderModuleExtra(mid);
    if (window.swiper && window.swiper.allowSlideNext)
      window.swiper.allowSlideNext = !isParentFunc("next") && isNextAllow();
  }

  window.setModuleExtra = setModuleExtra;

  function renderModuleExtra(mid) {
    let nPageOfModule = -1;
    for (var i = 0; i < moduleIds.length; i++) {
      var sum = 0;
      for (var j = 0; j < moduleIds[i].length; j++) {
        var moduleData = moduleExtra[moduleIds[i][j]];
        sum += moduleData.process || 0;

        if (mid === moduleIds[i][j]) {
          nPageOfModule = i;
        }
      }

      if (nPageOfModule === i) {
        var realProcess = sum / moduleIds[i].length;
        setProcess(i, realProcess);
      }
    }
  }

  function isNextAllow() {
    var enabled = true;
    $("[data-page-id='" + pageIndex + "'] [data-mod-id]").each(function (i, v) {
      var me = moduleExtra[$(v).attr("data-mod-id")];
      if (me.process !== 1 && enabled) enabled = false;
    });
    return !(!enabled && base?.sequential) || base?.preview;
  }

  window.isNextAllow = isNextAllow;

  function setProcess(id, value) {
    if (value !== 1 && process[id] === value) return;
    process[id] = value;

    if (!!queues.find((x) => x.id === id && x.value === value)) return;

    queues.push({ id, value });
    runQueue();

    reloadProcess();
    if (
      pageIds[id] === pageIndex &&
      value === 1 &&
      swiper &&
      autoPlay &&
      id < pageIds.length - 1
    ) {
      swiper.autoplay.timeLeft = 3000;
      swiper.autoplay.resume();
      $(".autoplay-progress").show();
    }

    console.log("setProcess", id, value, isParentFunc("next"), isNextAllow());
    setTimeout(() => {
      if (value === 1 && window.swiper)
        window.swiper.allowSlideNext = !isParentFunc("next") && isNextAllow();
    }, 500);
  }

  function reloadProcess() {
    menus.each(function (i, el) {
      var percent = process[i] || 0;
      if ($(el).find(".bar").get(0)) {
        $(el).find(".bar").get(0).style.setProperty("--progress", percent);
      }
      if (String(percent) === "1") $(el).addClass("finish");
    });
  }

  reloadProcess();

  function runQueue() {
    if (isQueue) return;
    if (queues.length === 0) {
      isQueue = false;
      return;
    }
    isQueue = true;
    var item = queues[0];
    queues.splice(0, 1);

    // RUN EXECUTE
    ScormSet("cmi.objectives." + item.id + ".progress_measure", item.value);

    var max = menus.length;
    var rate = 0;
    for (var i = 0; i < max; i++) {
      rate += process[i] || 0;
    }

    var finalRate = rate / (max + 0.0);
    ScormSet("cmi.progress_measure", finalRate);
    ScormSet(
      "cmi.completion_status",
      finalRate >= 1 ? "completed" : "incomplete",
    );

    setTimeout(function () {
      isQueue = false;
      runQueue();
    }, 300);
  }

  function onResize() {
    var w = window.innerWidth;
    if (w >= 768) w = w - 240;
    w = Math.min(w, 1040) - 40;
    $("iframe.youtube").attr("height", w * (3 / 5));
    $("iframe.docs").attr("height", w);
  }

  $(document).on("resize", onResize);
  onResize();

  var _loc = ScormGet("cmi.location") || "0_0";
  var pageIndex = _loc || pageIdItems.attr("data-page-id");
  $("[data-page-id='" + pageIndex + "']").addClass("active");

  function setPageIndex(index) {
    if (index !== "0_0") {
      var ix = pageIds.indexOf(index);
      var prevPageId = pageIds[ix - 1];
      var enabled = true;
      $("[data-page-id='" + prevPageId + "'] [data-mod-id]").each(
        function (i, v) {
          var me = moduleExtra[$(v).attr("data-mod-id")];
          if (me.process !== 1 && enabled) enabled = false;
        },
      );

      if (!enabled && base?.sequential && !base?.preview) return;
    }

    ScormSet("cmi.location", index);
    pageIndex = index;
    pageIdItems.removeClass("active");
    $("[data-page-id='" + index + "']").addClass("active");
    onScroll({ target: screenBody.get(0) });
    $("[data-page-id] video, [data-page-id] audio").each(function (i, el) {
      el.pause();
    });
  }

  window.setPageIndex = setPageIndex;

  $(window).hashchange(function () {
    if (location.hash.startsWith("#")) {
      var pid = location.hash.substring(1);
      var _el = $("[data-page-id='" + pid + "']");
      if (_el.length > 0) setPageIndex(pid);
    }
  });

  function pageShowed(id) {
    var nowPage = $("[data-page-id='" + id + "']");
    nowPage.find("video source:not([src])").each(function (v, el) {
      $(el).attr("src", $(el).attr("data-src"));
    });
    nowPage.find("video:not([src])").each(function (v, el) {
      $(el).attr("src", $(el).attr("data-src"));
    });
    nowPage.find("video").addClass("applyed");
    videoInit(nowPage);
    /*
        try {
            if (nowPage.find("video").length) {
                let v = nowPage.find("video").get(0);
                if (v && v.play) v.play();
            }
        } catch (e) {
        }
        */
    /*
        if (nowPage.find("video, audio")) {
            $("[data-mod-id]:has(video, audio)").each(function (ix, el) {
                var mid = $(el).attr("data-mod-id");
                if (moduleExtra[mid] && moduleExtra[mid].currentTime) {
                    $(el).find("video, audio").get(0).currentTime = moduleExtra[mid].currentTime;
                }
            })
        }
         */
  }

  if ($("#screen_body.SWIPE").length) {
    isSwipe = true;
    const progressCircle = document.querySelector(".autoplay-progress svg");
    const progressContent = document.querySelector(".autoplay-progress span");

    var init = {
      spaceBetween: 30,
      centeredSlides: true,
      navigation: {
        nextEl: "#screen_body > .swiper-button-next",
        prevEl: "#screen_body > .swiper-button-prev",
      },
      on: {
        autoplayTimeLeft(s, time, progress) {
          progressCircle.style.setProperty("--progress", 1 - progress);
          progressContent.textContent = `${Math.ceil(time / 1000)}s`;
        },
      },
      allowSlidePrev: !isPrevParents,
      allowSlideNext: !isNextParents && isNextAllow(),
    };

    if (isParentFunc("prev")) {
      $("#screen_body > .swiper-button-prev").click(function (e) {
        e.preventDefault();
        e.stopPropagation();

        window.parent.prevChangeONLesson();

        return false;
      });
    }

    if (isParentFunc("next")) {
      $("#screen_body > .swiper-button-next").click(function (e) {
        e.preventDefault();
        e.stopPropagation();

        window.parent.nextChangeOnLesson();
        return false;
      });
    } else {
      $("#screen_body > .swiper-button-next").click(function (e) {
        if (!isNextAllow()) {
          alert(NOT_ALLOWED_NEXT_MSG);
        }
      });
    }

    autoPlay = parseInt(screenBody.data("autoplay") || "0", 10);
    if (autoPlay > 0) {
      init.autoplay = {
        delay: autoPlay * 1000,
        pauseOnMouseEnter: true,
        disableOnInteraction: false,
        stopOnLastSlide: true,
      };
    }

    var loc = _loc || pageIdItems.attr("data-page-id");
    if (loc) {
      init.initialSlide = pageIds.indexOf(loc);
      pageShowed(pageIds[init.initialSlide] || pageIds[0]);
    } else {
      pageShowed(pageIds[0]);
    }

    swiper = new Swiper("#screen_body.SWIPE", init);
    window.swiper = swiper;

    swiper.on("slideChange", function ({ realIndex, isEnd, previousIndex }) {
      if (autoPlay && (process[realIndex] !== 1 || isEnd)) {
        swiper.autoplay.pause(false, true);
        $(".autoplay-progress").hide();
      } else {
        $(".autoplay-progress").show();
      }
      setPageIndex(pageIds[realIndex]);
      setProcess(realIndex, process[realIndex]);
      var prevPage = $("[data-page-id='" + pageIds[previousIndex] + "']");
      if (prevPage.find("video,audio")) {
        prevPage.find("video,audio").each(function (ix, el) {
          el.pause();
        });
      }
      if (!isEnd) {
        var nextPageId = pageIds[realIndex + 1];
        var enabled = true;
        $("[data-page-id='" + nextPageId + "'] [data-mod-id]").each(
          function (i, v) {
            var me = moduleExtra[$(v).attr("data-mod-id")];
            if (me.process !== 1 && enabled) enabled = false;
          },
        );
        if (!enabled && base?.sequential && !base?.preview) {
          swiper.allowSlideNext = false;
        } else {
          swiper.allowSlideNext = true;
        }
      }
      pageShowed(pageIds[realIndex]);
    });
    swiper.autoplay.pause();
    $(".autoplay-progress").hide();
  } else {
    if (!$(".page-item").hasClass("active")) $(".page-item").addClass("active");
    var loc2 = _loc || pageIdItems.attr("data-page-id");
    if (loc2) {
      if (pageIds.indexOf(loc2) > -1) {
        pageShowed(loc2);
      } else {
        pageShowed(pageIds[0]);
      }
    } else {
      pageShowed(pageIds[0]);
    }
  }

  if (!pageIndex) {
    setPageIndex(_loc || pageIdItems.attr("data-page-id"));
  } else {
    setPageIndex(pageIndex);
  }

  $(".module-slide.active").each(function (ix, el) {
    var mid = $(el).parents("[data-mod-id]").attr("data-mod-id");
    var init = {
      spaceBetween: 30,
      centeredSlides: true,
      nested: true,
      navigation: {
        nextEl: $(el).find(".swiper-button-next").get(0),
        prevEl: $(el).find(".swiper-button-prev").get(0),
      },
      pagination: {
        el: $(el).find(".swiper-pagination").get(0),
        type: "bullets",
      },
      noSwiping: true,
      noSwipingClass: "swiper-no-swiping",
      on: {
        slideChange({ realIndex, progress }) {
          setModuleExtra(mid, { process: progress, index: realIndex });
        },
      },
    };

    if (moduleExtra[mid].index) {
      init.initialSlide = moduleExtra[mid].index;
    }
    new Swiper(el, init);
  });

  function toggle_menu() {
    var root = $("#root");
    if (
      root.hasClass("menu-on") ||
      (!root.hasClass("menu-off") && window.innerWidth > 767)
    ) {
      root.addClass("menu-off");
      root.removeClass("menu-on");
      // if (swiper) {
      //     if (autoPlay) swiper.autoplay.start();
      //     $("#screen_body.SWIPE").removeClass("autoplay-stop");
      // }
    } else {
      root.removeClass("menu-off");
      root.addClass("menu-on");
      // if (swiper) {
      //     if (autoPlay) swiper.autoplay.pause();
      //     $("#screen_body.SWIPE").addClass("autoplay-stop");
      // }
    }
  }

  window.toggle_menu = toggle_menu;

  menus.click(function () {
    var id = $(this).attr("data-page-id");
    if (!isSwipe || !swiper) {
      setPageIndex(id);
    } else {
      var index = id;
      if (index !== "0_0") {
        var ix = pageIds.indexOf(index);
        var prevPageId = pageIds[ix - 1];
        var enabled = true;
        $("[data-page-id='" + prevPageId + "'] [data-mod-id]").each(
          function (i, v) {
            var me = moduleExtra[$(v).attr("data-mod-id")];
            if (me.process !== 1 && enabled) enabled = false;
          },
        );

        if (!enabled && base?.sequential && !base?.preview) {
          alert(NOT_ALLOWED_NEXT_MSG);
          return;
        }
      }
      var realIndex = pageIds.indexOf(id);
      swiper.slideTo(realIndex);
    }
  });

  function onScroll(e) {
    $(".page-item.active .module-item").each(function (ix, el) {
      var p = el.getBoundingClientRect();
      if (p.y + p.height < window.innerHeight + 30) {
        var mid = $(el).attr("data-mod-id");
        if (!moduleExtra[mid].act) setModuleExtra(mid, { process: 1 });
      }
    });
  }

  document.addEventListener("scroll", onScroll, true /*Capture event*/);

  const intervalTargets = [];
  setInterval(function () {
    for (var target of intervalTargets) {
      var mid = $(target).parents("[data-mod-id]").attr("data-mod-id");
      var nCurr = moduleExtra[mid] ? moduleExtra[mid].currentTime || 0 : 0;
      var currentTime = Math.max(target.currentTime, nCurr);
      var process = currentTime / target.duration;
      setModuleExtra(mid, { process, currentTime: currentTime });
    }
  }, 20000);

  function setQuizValueSelect(o) {
    var parent = $(o).parents("[data-mod-valcheck]");
    var mid = parent.attr("data-mod-valcheck");

    var vs = [];
    parent.find("input:checked").each(function (i, v) {
      vs.push(v.value);
    });
    setQuizValue(mid, vs);
  }

  window.setQuizValueSelect = setQuizValueSelect;

  function setQuizValue(mid, vs) {
    var p = $(".module-quiz[data-mod-valcheck='" + mid + "']");
    var answers = [];
    try {
      answers = JSON.parse(p.find("textarea").val());
    } catch (e) {
      var value = p.find("textarea").val()?.trim();
      if (value.startsWith("[")) value = value.substring(1, value.length);
      if (value.endsWith("]")) value = value.substring(0, value.length - 1);
      answers = value.split(",");
    }
    var state = "fail";
    if (p.find(".quiz-ul-select")?.length > 0) {
      // 객관식
      var anstext = "";
      answers.sort();
      answers.forEach(function (e) {
        anstext += e + "_";
      });

      var vtext = "";
      vs.sort();
      vs.forEach(function (e) {
        vtext += e + "_";
      });

      if (anstext === vtext) {
        state = "ok";
      }
    } else {
      // 주관식, OX

      if (
        !!answers.find((x) => {
          var uv = vs[0];
          const o = String(x).toLowerCase().replaceAll("[^0-9a-z가-힣]", "");
          const u = String(uv).toLowerCase().replaceAll("[^0-9a-z가-힣]", "");
          return o === u;
        })
      ) {
        state = "ok";
      }
    }

    setModuleExtra(mid, { process: 1, vals: vs, state });
    quizRender();
  }

  window.setQuizValue = setQuizValue;

  function setQuizVal(o) {
    var parent = $(o).parents("[data-mod-valcheck]");
    var uv = o.value;
    var answers = JSON.parse(parent.find("textarea").val());

    var state = "fail";
    if (
      !!answers.find((x) => {
        const o = String(x).toLowerCase().replaceAll("[^0-9a-z가-힣]", "");
        const u = String(uv).toLowerCase().replaceAll("[^0-9a-z가-힣]", "");
        return o === u;
      })
    ) {
      state = "ok";
    }

    var mid = parent.parents("[data-mod-id]").attr("data-mod-id");
    setModuleExtra(mid, { process: 1, val: uv, state });
    quizRender();
  }

  window.setQuizVal = setQuizVal;

  function quizRender() {
    for (var key of Object.keys(moduleExtra)) {
      var parent = $("[data-mod-valcheck='" + key + "']");
      if (!parent.hasClass("proc") && moduleExtra[key].state) {
        parent.addClass("proc");
      }
      parent.removeClass("fail");
      parent.removeClass("ok");
      parent.addClass(moduleExtra[key].state);

      var el = $("input[name='answer_" + key + "']");
      if (el.length > 0) {
        var t = el.attr("type");
        if (t === "radio") {
          var val = moduleExtra[key].vals[0];
          $("input[name='answer_" + key + "'][value='" + val + "']").prop(
            "checked",
            true,
          );
        } else if (t === "checkbox") {
          var vals = moduleExtra[key].vals || [];
          for (var val of vals) {
            $("input[name='answer_" + key + "'][value='" + val + "']").prop(
              "checked",
              true,
            );
          }
        } else {
          var val = moduleExtra[key].vals[0];
          $("input[name='answer_" + key + "']").val(val);
        }
      }
    }
  }

  quizRender();
  reloadProcess();

  function videoInit(nowPage) {
    $("video").attr({
      "webkit-playsinline": true,
      webkitplaysinline: true,
      playsinline: true,
    });

    $("video.applyed:not(.video-js)")
      .addClass("video-js")
      .each((ix, el) => {
        const args = {
          fluid: !$(el).parents(".page-item").hasClass("single"),
          controlBar: { pictureInPictureToggle: false },
          preferFullWindow: true,
        };

        if (window.document.domain.indexOf("leaders") > -1) {
          args.preferFullWindow = false;
        }

        if (base.videoSpeed) {
          args.playbackRates = [0.75, 1, 1.25, 1.5, 1.75, 2.0];
        }
        if (base.videoRepeat) {
          //args.plugins = {abLoopPlugin: {}};
        }

        args.html5 = { vhs: { withCredentials: true, overrideNative: true } };

        let vjs = videojs(el, args);
        vjs.ready(function () {
          let player = this;
          let mid = $(this.el_).parents("[data-mod-id]").attr("data-mod-id");
          setTimeout(() => {
            if (!base.videoSeek) {
              player.on("seeking", function (event) {
                let currentTime = !moduleExtra[mid]
                  ? 0
                  : moduleExtra[mid]?.currentTime || 0;
                if (
                  currentTime >= 0 &&
                  currentTime <
                    player.currentTime() - getRequestedScormDiffTime()
                ) {
                  player.currentTime(currentTime);
                }
              });

              player.on("seeked", function (event) {
                let currentTime = !moduleExtra[mid]
                  ? 0
                  : moduleExtra[mid]?.currentTime || 0;
                if (
                  currentTime >= 0 &&
                  currentTime <
                    player.currentTime() - getRequestedScormDiffTime()
                ) {
                  player.currentTime(currentTime);
                }
              });
            }

            if (base.watermark) {
              for (var i = 0; i < 3; i++) {
                vjs.dynamicWatermark({
                  elementId: "vwm_unique_" + i,
                  changeDuration: 100 * 1000,
                  watermarkText: (uname || "[미리보기]") + "<br />" + nowStr,
                  cssText:
                    "font-size: 1rem; " +
                    "z-index: 9999; " +
                    "position: absolute; left: 0px ",
                });
              }
            }
          }, 0);

          if (nowPage) {
            player.currentTime(moduleExtra[mid].currentTime);
          }
        });

        if (
          navigator.userAgent.match(/iPhone|iPad|like Mac OS X/i) &&
          window.document.domain.indexOf("leaders") < 0
        ) {
          vjs.off("fullscreenchange");
          vjs.on("fullscreenchange", function () {
            if (vjs.isFullscreen()) {
              $("#root").addClass("menu-off");
              $("#root").removeClass("menu-on");
              $("#screen_menu button").css("visibility", "hidden");
              $(".swiper-button-prev").css("visibility", "hidden");
              $(".swiper-button-next").css("visibility", "hidden");
              $("#watermark").css("visibility", "hidden");
              window.parent.postMessage("toggleiOSMobileFullscreen");
            } else {
              $("#screen_menu button").css("visibility", "visible");
              $(".swiper-button-prev").css("visibility", "visible");
              $(".swiper-button-next").css("visibility", "visible");
              $("#watermark").css("visibility", "visible");
              window.parent.postMessage("toggleiOSMobileFullscreen");
            }
          });
        }
      });

    setTimeout(() => {
      $("audio, video")
        .on("play", function () {
          intervalTargets.push(this);
          if (autoPlay && swiper) {
            swiper.autoplay.pause();
            $(".autoplay-progress").hide();
          }
        })
        .on("pause", function () {
          var ix = intervalTargets.indexOf(this);
          if (ix >= 0) intervalTargets.splice(ix, 1);
        })
        .on("ended", function () {
          var ix = intervalTargets.indexOf(this);
          if (ix >= 0) intervalTargets.splice(ix, 1);

          var mid = $(this).parents("[data-mod-id]").attr("data-mod-id");
          setModuleExtra(mid, { process: 1 });
        });
    }, 500);

    if (nowPage) {
      setTimeout(() => {
        var v = nowPage.find("video").get(0);
        if (v && v.play) {
          v.play();
        }
      }, 500);
    }
  }

  // videoInit();

  $("audio")
    .addClass("video-js vjs-theme-fantasy")
    .each((ix, el) => {
      videojs(el, {
        audioOnlyMode: true,
        html5: { vhs: { withCredentials: true } },
        // children: [
        //     'controlBar'
        // ]
      });
    });

  $("video, audio").on("contextmenu", function (e) {
    e.preventDefault();
  });

  if (base.watermark) {
    if ($("#watermark").size() > 0) {
      var name = uname || "[미리보기]";
      var html = name + "<br/>\n" + nowStr;

      $("#watermark p").html(html);
    }
  }

  function isParentFunc(type) {
    let isExist = false;
    try {
      if (type === "next") {
        isExist = !!window.parent && !!window.parent.nextChangeOnLesson;
      } else {
        isExist = !!window.parent && !!window.parent.prevChangeONLesson;
      }
    } catch (ex) {}

    return isExist;
  }
}
