var ScormGet = undefined;
var ScormSet = undefined;
// 운영 환경에서는 SCORM API를, 로컬 미리보기에서는 localStorage를 사용한다.
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
var learnerId = ScormGet("cmi.learner_id") || "";
var learnerComp = ScormGet("cmi.learner_comp") || "";

var pageIds = [];
var moduleIds = [];
var modulePageIndexMap = {};
var pageModuleMap = {};
var pagePassiveModuleElementsMap = {};

var process = [];
var queues = [];
var isQueue = false;
var totalProcessSum = 0;

var swiper = undefined;
var isSwipe = false;
var autoPlay = undefined;
var isIOSDevice = /iP(hone|ad|od)/i.test(navigator.userAgent);
var watermarkRefreshTimer = null;

const NOT_ALLOWED_NEXT_MSG = "현재 페이지 학습 완료 후 다음 학습이 가능합니다.";

function getCurrentTimeString() {
  var date = new Date();
  return (
    date.getFullYear() +
    "." +
    String(date.getMonth() + 1).padStart(2, "0") +
    "." +
    String(date.getDate()).padStart(2, "0") +
    " " +
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}

function getCurrentTimeCompactString() {
  var date = new Date();
  return (
    date.getFullYear() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0") +
    String(date.getHours()).padStart(2, "0") +
    String(date.getMinutes()).padStart(2, "0")
  );
}

function isStarbucksWatermark() {
  return learnerComp === "EE0";
}

function ensureWatermarkContainer() {
  var $watermark = $("#watermark");
  if ($watermark.length > 0) return $watermark;

  $watermark = $('<div id="watermark" aria-hidden="true"></div>');
  $("body").append($watermark);
  return $watermark;
}

function getWatermarkTextPlain() {
  if (isStarbucksWatermark()) {
    const maskedUname = uname
      ? uname[0] + "*".repeat(uname.length - 2) + uname[uname.length - 1]
      : "[미리보기]";
    return [
      learnerId || "[사번없음]",
      maskedUname || "[미리보기]",
      getCurrentTimeCompactString(),
    ]
      .join(" ")
      .trim();
  }

  return (uname || "[미리보기]") + " " + getCurrentTimeString();
}

function getWatermarkHtml() {
  if (isStarbucksWatermark()) {
    return getWatermarkTextPlain();
  }

  return (uname || "[미리보기]") + "<br/>\n" + getCurrentTimeString();
}

function buildStarbucksWatermarkHtml(text) {
  var viewportWidth =
    window.innerWidth || document.documentElement.clientWidth || 1920;
  var viewportHeight =
    window.innerHeight || document.documentElement.clientHeight || 1080;
  var cellWidth = 260;
  var cellHeight = 120;
  var diagonal = Math.sqrt(
    viewportWidth * viewportWidth + viewportHeight * viewportHeight,
  );
  var gridSize = Math.ceil(diagonal * 2.8);
  var columns = Math.max(12, Math.ceil(gridSize / cellWidth));
  var rows = Math.max(16, Math.ceil(gridSize / cellHeight));
  var html = "";

  for (var row = 0; row < rows; row++) {
    html += '<div class="sb-watermark-row">';
    for (var column = 0; column < columns; column++) {
      html +=
        '<span class="sb-watermark-cell' +
        (row % 2 === 1 ? " is-offset" : "") +
        '">' +
        text +
        "</span>";
    }
    html += "</div>";
  }

  return (
    '<div class="sb-watermark-grid" style="width:' +
    gridSize +
    "px;height:" +
    gridSize +
    'px;">' +
    html +
    "</div>"
  );
}

function getPlayerWatermarkHtml(html) {
  if (isStarbucksWatermark()) {
    return buildStarbucksWatermarkHtml(html);
  }

  return (
    '<div class="no1"><p>' +
    html +
    '</p></div><div class="no2"><p>' +
    html +
    '</p></div><div class="no3"><p>' +
    html +
    "</p></div>"
  );
}

function ensurePlayerWatermarkOverlay(playerEl) {
  if (!playerEl) return null;
  var $player = $(playerEl);
  var $overlay = $player.children(".player-watermark-overlay").first();
  if ($overlay.length) return $overlay;

  $overlay = $(
    '<div class="player-watermark-overlay" aria-hidden="true"></div>',
  );
  $player.append($overlay);
  return $overlay;
}

function refreshPlayerWatermarkOverlays(html) {
  $(".player-watermark-overlay").each(function () {
    var $overlay = $(this);
    $overlay
      .toggleClass("sb-watermark", isStarbucksWatermark())
      .toggleClass("default-watermark", !isStarbucksWatermark())
      .html(getPlayerWatermarkHtml(html));
  });
}

function refreshWatermarkText() {
  if (!base || !base.watermark) return;

  var $watermark = ensureWatermarkContainer();
  var html = getWatermarkHtml();
  if (isStarbucksWatermark()) {
    $watermark
      .addClass("sb-watermark")
      .removeClass("default-watermark")
      .html(buildStarbucksWatermarkHtml(html));
  } else {
    $watermark.addClass("default-watermark").removeClass("sb-watermark");
    $watermark.find(".sb-watermark-grid").remove();
    if ($watermark.find("p").length === 0) {
      $watermark.html(
        '<div class="no1"><p></p></div><div class="no2"><p></p></div><div class="no3"><p></p></div>',
      );
    }
    if ($watermark.find("p").length > 0) {
      $watermark.find("p").html(html);
    }
  }

  if (!isStarbucksWatermark()) {
    for (var i = 0; i < 3; i++) {
      var $wm = $("#vwm_unique_" + i);
      if ($wm.length > 0) {
        $wm.html(html);
      }
    }
  }

  refreshPlayerWatermarkOverlays(html);
}

function startWatermarkRefresh() {
  if (watermarkRefreshTimer) {
    clearInterval(watermarkRefreshTimer);
  }

  refreshWatermarkText();
  // 분 단위 표기라서 30초마다 갱신해 시각 오차를 최소화한다.
  // watermarkRefreshTimer = setInterval(refreshWatermarkText, 30 * 1000);
}

function setVideoWatermarkVisibility(isVisible) {
  for (var i = 0; i < 3; i++) {
    $("#vwm_unique_" + i).css("visibility", isVisible ? "visible" : "hidden");
  }
}

function getSafeRequestedScormDiffTime() {
  try {
    if (typeof getRequestedScormDiffTime === "function") {
      var diff = Number(getRequestedScormDiffTime());
      return Number.isFinite(diff) ? diff : 0;
    }
  } catch (e) {}
  return 0;
}

var _c = $("#details").val();
// 학습 본문 HTML을 불러온 뒤 화면/진도 초기화를 시작한다.
$.ajax("./launch_view.html", {
  method: _c ? "POST" : "GET",
  data: _c,
  dataType: "html",
  contentType: "application/json; charset=utf-8",
  success: function (a) {
    $("#root").html(a);
    // CDN 절대경로를 상대경로로 치환해 배포 환경별 경로 차이를 줄인다.
    var _cdnDomains = [
      "https://d1vdu6u8ovnv72.cloudfront.net",
      "https://drqh6545bixgo.cloudfront.net",
      "https://sra-dev.spharosacademy.com",
      "https://sra.spharosacademy.com",
    ];
    _cdnDomains.forEach(function (domain) {
      $("#root")
        .find("[src^='" + domain + "']")
        .each(function () {
          $(this).attr("src", $(this).attr("src").replace(domain, ""));
        });
      $("#root")
        .find("[data-src^='" + domain + "']")
        .each(function () {
          $(this).attr(
            "data-src",
            $(this).attr("data-src").replace(domain, ""),
          );
        });
    });

    // 비디오는 캐시 이슈를 피하기 위해 쿼리스트링을 붙여 새로 읽도록 한다.
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

    // 페이지 영역의 이미지는 초기에 src를 data-src로 옮겨 두고,
    // 현재 페이지가 열릴 때만 다시 복원해 메모리 사용량을 줄인다.
    $("#root")
      .find("[data-page-id] img[src]")
      .each(function () {
        var s = $(this).attr("src");
        if (s && !s.startsWith("data:")) {
          $(this)
            .attr("data-origin-src", s)
            .attr("data-src", s)
            .attr("decoding", "async")
            .attr("loading", "lazy")
            .removeAttr("src");
        }
      });

    page_initialize();
  },
});

var isPrevParents = false;
var isNextParents = false;
var isIOSVideoFullscreen = false;
var isIOSRotating = false;
var iosFullscreenSyncTimer = null;
var iosRotationTimer = null;
var iosPendingImageRefreshForce = false;
var iosPendingImageRefresh = false;
var iosLastFullscreenSyncState = null;
var iosCustomFullscreenPlayer = null;
var iosCustomFullscreenLayer = null;
var iosCustomFullscreenPlaceholder = null;
var iosCustomFullscreenParent = null;
var iosCustomFullscreenNextSibling = null;
var iosControlToggleLockUntil = 0;
var iosControlToggleCooldown = 450;
var iosFullscreenResumeHandler = null;
var iosFullscreenVisibilityHandler = null;
window.refreshActivePageImages = null;

function logIOSFullscreenDebug(stage, extra) {
  return;
}
try {
  isNextParents = !!window.parent && !!window.parent.nextChangeOnLesson;
  isPrevParents = !!window.parent && !!window.parent.prevChangeONLesson;
} catch (ex) {}

function setIOSFullscreenUI(isFullscreen) {
  if (isFullscreen) {
    $("#root").addClass("menu-off");
    $("#root").removeClass("menu-on");
    $("#screen_menu button").css("visibility", "hidden");
    $(".swiper-button-prev").css("visibility", "hidden");
    $(".swiper-button-next").css("visibility", "hidden");
  } else {
    $("#screen_menu button").css("visibility", "visible");
    $(".swiper-button-prev").css("visibility", "visible");
    $(".swiper-button-next").css("visibility", "visible");
  }
  updateSwipeNavigationVisibility();
}

function updateSwipeNavigationVisibility() {
  var prevButton = $("#screen_body > .swiper-button-prev");
  var nextButton = $("#screen_body > .swiper-button-next");
  if (!prevButton.length && !nextButton.length) return;

  if (isIOSVideoFullscreen) {
    prevButton.css("visibility", "hidden");
    nextButton.css("visibility", "hidden");
    return;
  }

  var currentIndex = 0;
  if (window.swiper && typeof window.swiper.realIndex === "number") {
    currentIndex = window.swiper.realIndex;
  } else {
    var activePageId = $("[data-page-id].active").first().attr("data-page-id");
    var activeIndex = pageIds.indexOf(activePageId);
    currentIndex = activeIndex > -1 ? activeIndex : 0;
  }

  prevButton.css("visibility", currentIndex <= 0 ? "hidden" : "visible");
  nextButton.css(
    "visibility",
    currentIndex >= pageIds.length - 1 ? "hidden" : "visible",
  );
}

function syncIOSVideoFullscreen(isFullscreen) {
  clearTimeout(iosFullscreenSyncTimer);
  iosFullscreenSyncTimer = setTimeout(
    function () {
      logIOSFullscreenDebug("sync-start", {
        isFullscreen: isFullscreen,
        rotating: isIOSRotating,
        lastState: iosLastFullscreenSyncState,
      });
      setIOSFullscreenUI(isFullscreen);
      if (isIOSRotating) return;
      if (iosLastFullscreenSyncState === isFullscreen) return;
      iosLastFullscreenSyncState = isFullscreen;
      try {
        logIOSFullscreenDebug("postMessage", {
          message: "toggleiOSMobileFullscreen",
          isFullscreen: isFullscreen,
        });
        window.parent.postMessage("toggleiOSMobileFullscreen");
      } catch (e) {}

      if (
        !isFullscreen &&
        iosPendingImageRefresh &&
        typeof window.refreshActivePageImages === "function"
      ) {
        var forceRefresh = iosPendingImageRefreshForce;
        iosPendingImageRefresh = false;
        iosPendingImageRefreshForce = false;
        window.refreshActivePageImages(forceRefresh);
      }
    },
    isFullscreen ? 120 : 220,
  );
}

function setIOSCustomVideoFullscreen(playerEl, isFullscreen) {
  if (!playerEl) return;

  var ensureIOSCustomFullscreenLayer = function () {
    if (iosCustomFullscreenLayer && iosCustomFullscreenLayer.length) {
      return iosCustomFullscreenLayer;
    }

    iosCustomFullscreenLayer = $(
      '<div id="ios_custom_video_fullscreen_layer" aria-hidden="true"></div>',
    );
    $("body").append(iosCustomFullscreenLayer);
    return iosCustomFullscreenLayer;
  };

  if (isFullscreen) {
    if (iosCustomFullscreenPlayer === playerEl) {
      $("#root").addClass("ios-video-fullscreen-on");
      playerEl.classList.add("ios-video-fullscreen");
      return;
    }

    var $layer = ensureIOSCustomFullscreenLayer();
    iosCustomFullscreenParent = playerEl.parentNode || null;
    iosCustomFullscreenNextSibling = playerEl.nextSibling || null;
    iosCustomFullscreenPlaceholder = document.createComment(
      "ios-custom-fullscreen-player",
    );
    if (iosCustomFullscreenParent) {
      iosCustomFullscreenParent.insertBefore(
        iosCustomFullscreenPlaceholder,
        playerEl,
      );
    }

    iosCustomFullscreenPlayer = playerEl;
    $("#root").addClass("ios-video-fullscreen-on");
    $layer.addClass("active").append(playerEl);
    playerEl.classList.add("ios-video-fullscreen");
  } else {
    var playerToRestore = iosCustomFullscreenPlayer || playerEl;
    if (playerToRestore) {
      playerToRestore.classList.remove("ios-video-fullscreen");
    }
    if (
      playerToRestore &&
      iosCustomFullscreenParent &&
      iosCustomFullscreenPlaceholder &&
      iosCustomFullscreenPlaceholder.parentNode === iosCustomFullscreenParent
    ) {
      iosCustomFullscreenParent.insertBefore(
        playerToRestore,
        iosCustomFullscreenPlaceholder,
      );
      iosCustomFullscreenPlaceholder.parentNode.removeChild(
        iosCustomFullscreenPlaceholder,
      );
    } else if (
      playerToRestore &&
      iosCustomFullscreenParent &&
      iosCustomFullscreenNextSibling &&
      iosCustomFullscreenNextSibling.parentNode === iosCustomFullscreenParent
    ) {
      iosCustomFullscreenParent.insertBefore(
        playerToRestore,
        iosCustomFullscreenNextSibling,
      );
    } else if (playerToRestore && iosCustomFullscreenParent) {
      iosCustomFullscreenParent.appendChild(playerToRestore);
    }

    if (iosCustomFullscreenLayer && iosCustomFullscreenLayer.length) {
      iosCustomFullscreenLayer.removeClass("active");
    }
    $("#root").removeClass("ios-video-fullscreen-on");
    iosCustomFullscreenPlayer = null;
    iosCustomFullscreenPlaceholder = null;
    iosCustomFullscreenParent = null;
    iosCustomFullscreenNextSibling = null;
  }
}

function bindIOSNativeVideoFullscreenEvents(candidates, onEnter, onExit) {
  var bound = false;

  candidates.forEach(function (candidate) {
    if (!candidate || !candidate.addEventListener) return;
    if (
      candidate.getAttribute &&
      candidate.getAttribute("data-ios-fullscreen-bound")
    ) {
      bound = true;
      return;
    }

    if (candidate.setAttribute) {
      candidate.setAttribute("data-ios-fullscreen-bound", "1");
    }

    candidate.addEventListener("webkitbeginfullscreen", onEnter);
    candidate.addEventListener("webkitendfullscreen", onExit);
    candidate.addEventListener("webkitpresentationmodechanged", function () {
      var mode = candidate.webkitPresentationMode || "";
      logIOSFullscreenDebug("presentation-mode", { mode: mode });
      if (mode === "fullscreen") {
        onEnter();
      } else {
        onExit();
      }
    });
    bound = true;
  });

  return bound;
}

function isVideoControlInteractionTarget(target, rootEl) {
  if (!target || !rootEl) return false;
  if (target === rootEl) return false;
  if (typeof target.closest !== "function") return false;

  return !!target.closest(
    ".vjs-control-bar, .vjs-big-play-button, .vjs-modal-dialog, .vjs-menu, .vjs-button, .vjs-slider",
  );
}

function bindIOSControlBarToggleTargets(player) {
  if (!player || !player.el_) return;
  if (player.el_.getAttribute("data-ios-control-toggle-bound")) return;

  player.el_.setAttribute("data-ios-control-toggle-bound", "1");

  var toggleHandler = function (event) {
    var now = Date.now();
    if (
      !isIOSVideoFullscreen ||
      !iosCustomFullscreenPlayer ||
      iosCustomFullscreenPlayer !== player.el_
    ) {
      return;
    }

    if (isVideoControlInteractionTarget(event.target, player.el_)) {
      return;
    }

    if (now < iosControlToggleLockUntil) {
      return;
    }
    iosControlToggleLockUntil = now + 320;

    if (player.controlBar && typeof player.userActive === "function") {
      player.userActive(!player.userActive());
    }

    if (event && typeof event.stopPropagation === "function") {
      event.stopPropagation();
    }
  };

  var targets = [
    player.el_,
    player.tech_ && player.tech_.el_,
    player.el_.querySelector ? player.el_.querySelector(".vjs-tech") : null,
    player.el_.querySelector ? player.el_.querySelector("video") : null,
    player.el_.querySelector ? player.el_.querySelector(".vjs-poster") : null,
  ].filter(Boolean);

  targets.forEach(function (target, index) {
    if (
      target !== player.el_ &&
      target.getAttribute &&
      target.getAttribute("data-ios-control-toggle-bound")
    ) {
      return;
    }

    if (target !== player.el_ && target.setAttribute) {
      target.setAttribute("data-ios-control-toggle-bound", "1");
    }

    target.addEventListener("touchend", toggleHandler, false);
  });
}

function ensureIOSFullscreenTapOverlay(player) {
  if (!player || !player.el_) return;

  var existing =
    player.el_.querySelector &&
    player.el_.querySelector(".ios-fullscreen-tap-overlay");
  if (existing) return existing;

  var overlay = document.createElement("button");
  overlay.type = "button";
  overlay.className = "ios-fullscreen-tap-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("tabindex", "-1");

  var onToggle = function (event) {
    if (
      !isIOSVideoFullscreen ||
      !iosCustomFullscreenPlayer ||
      iosCustomFullscreenPlayer !== player.el_
    ) {
      return;
    }

    var now = Date.now();
    if (now < iosControlToggleLockUntil) {
      return;
    }
    iosControlToggleLockUntil = now + iosControlToggleCooldown;

    if (typeof player.userActive === "function") {
      player.userActive(!player.userActive());
    }

    if (event) {
      if (typeof event.preventDefault === "function") event.preventDefault();
      if (typeof event.stopPropagation === "function") event.stopPropagation();
    }
  };

  overlay.addEventListener("touchend", onToggle, false);
  overlay.addEventListener("click", onToggle, false);

  player.el_.appendChild(overlay);
  return overlay;
}

function lockIOSControlToggle(duration) {
  iosControlToggleLockUntil = Date.now() + (duration || iosControlToggleCooldown);
}

function resetIOSPlayerControlState(player, isFullscreen) {
  if (!player || typeof player.userActive !== "function") return;

  lockIOSControlToggle(isFullscreen ? 600 : 700);
  player.userActive(true);

  if (!isFullscreen) {
    setTimeout(function () {
      if (typeof player.userActive === "function") {
        player.userActive(true);
      }
    }, 120);
  }
}

// 브라우저 또는 앱 컨테이너 환경에 맞는 전체화면 진입 처리
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

// 브라우저 또는 앱 컨테이너 환경에 맞는 전체화면 종료 처리
const exitFullScrren = () => {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitCancelFullscreen) return document.webkitCancelFullscreen();
  if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
  if (document.msExitFullscreen) return document.msExitFullscreen();
};

// 전체화면이 해제되면 임시 UI 상태도 함께 원복한다.
const handleResize = () => {
  if (isIOSDevice && isIOSVideoFullscreen) return;
  if (!document.fullscreenElement) {
    $(".fullscreen-el").removeClass("fullscreen-el");
    $("#root").removeClass("menu-hide");
  }
  if (base && base.watermark && isStarbucksWatermark()) {
    refreshWatermarkText();
  }
};
window.addEventListener("resize", handleResize);
window.addEventListener("orientationchange", function () {
  if (!isIOSDevice) return;
  isIOSRotating = true;
  clearTimeout(iosRotationTimer);
  setIOSFullscreenUI(isIOSVideoFullscreen);
  iosRotationTimer = setTimeout(function () {
    isIOSRotating = false;
    setIOSFullscreenUI(isIOSVideoFullscreen);
    if (
      !isIOSVideoFullscreen &&
      typeof window.refreshActivePageImages === "function"
    ) {
      window.refreshActivePageImages(true);
    } else if (isIOSVideoFullscreen) {
      iosPendingImageRefresh = true;
      iosPendingImageRefreshForce = true;
    }
  }, 700);
});

const allowFullscreen = () => {
  return !!(
    document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen ||
    document.documentElement.mozRequestFullScreen ||
    document.documentElement.msRequestFullscreen
  );
};

var html_intfs = {};

// iframe 기반 문서 모듈과 부모 창 사이 메시지를 받아 진행률과 전체화면 상태를 반영한다.
$(window).on("message onmessage", function (e) {
  var data = e.originalEvent.data; // Should work.
  var source = e.originalEvent.source;
  if (typeof data !== "string") return;
  if (data.startsWith("$DOC_SIGHT$")) {
    var json = data.substring(11);
    var raw = null;
    try {
      raw = JSON.parse(json);
    } catch (err) {
      return;
    }
    if (!raw || typeof raw !== "object") return;
    if (source && source !== window && source !== window.parent) {
      var matchedFrame = $("iframe[data-extra='" + raw.extra + "']").get(0);
      if (!matchedFrame || matchedFrame.contentWindow !== source) return;
    }
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
    var separatorIndex = data.indexOf("/");
    if (separatorIndex <= 0) return;
    var uuid = data.substring(0, data.indexOf("/"));
    var val = parseInt(data.substring(data.indexOf("/") + 1), 10);
    var handler = window["fn_" + uuid];
    if (typeof handler !== "function" || Number.isNaN(val)) return;
    handler(val);
  }
});

function page_initialize() {
  // 화면 초기화, 페이지 목록 구성, 진행률 계산, 이벤트 등록을 담당한다.
  var screenBody = $("#screen_body");
  var pageIdItems = $("[data-page-id]");
  var menus = $(".index-list [data-page-id]");
  var menuElements = menus.toArray();
  var menuElementMap = {};
  var pageMoreIndicator = null;
  var pageMoreIndicatorTimer = null;
  var pageMoreObserver = null;
  var pageMoreObservedPage = null;
  var pageMoreObservedLoadHandler = null;

  // ===== More Indicator / Scroll Target =====
  // 하단 more 버튼을 한 번만 생성하고 재사용한다.
  function ensurePageMoreIndicator() {
    if (pageMoreIndicator && pageMoreIndicator.length) return pageMoreIndicator;

    pageMoreIndicator = $(
      '<button id="page_more_indicator" type="button" aria-label="아래 학습 내용 더 보기">' +
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>' +
        "</svg>" +
        "</button>",
    );

    pageMoreIndicator.on("click", function () {
      var target = getPageMoreScrollTarget();
      if (!target) return;

      var currentTop = getScrollTop(target);
      var viewportHeight = getClientHeight(target);
      var nextTop = currentTop + Math.max(viewportHeight * 0.7, 240);
      scrollToTop(target, nextTop);
    });

    $("body").append(pageMoreIndicator);
    return pageMoreIndicator;
  }

  // 실제로 스크롤 이동이 필요한 요소인지 판별한다.
  function isScrollableElement(el) {
    if (!el) return false;
    return el.scrollHeight - el.clientHeight > 16;
  }

  // 페이지 내부에서 사용자가 직접 스크롤하는 컨테이너를 우선 찾는다.
  // 긴 이미지/문서형 모듈처럼 page-item 내부에 별도 overflow 영역이 있는 케이스를 위한 탐색이다.
  function getScrollableDescendant(root) {
    if (!root || !root.querySelectorAll) return null;

    var nodes = root.querySelectorAll("*");
    var best = null;
    var bestHeight = 0;

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!isScrollableElement(node)) continue;

      var style = window.getComputedStyle(node);
      var overflowY = style ? style.overflowY : "";
      if (overflowY !== "auto" && overflowY !== "scroll") continue;

      var rect = node.getBoundingClientRect();
      if (
        rect.height <= 0 ||
        rect.bottom <= 0 ||
        rect.top >= window.innerHeight
      )
        continue;

      if (node.clientHeight > bestHeight) {
        best = node;
        bestHeight = node.clientHeight;
      }
    }

    return best;
  }

  // more 버튼과 근접 자동완료가 공통으로 사용할 "현재 페이지의 실제 스크롤 대상"을 찾는다.
  function getPageMoreScrollTarget() {
    var activePage = $("[data-page-id].active").first().get(0);
    var innerScrollable = getScrollableDescendant(activePage);
    if (innerScrollable) return innerScrollable;

    if (activePage && isScrollableElement(activePage)) return activePage;

    var bodyEl = screenBody.get(0);
    if (bodyEl && isScrollableElement(bodyEl)) return bodyEl;

    var docEl = document.scrollingElement || document.documentElement;
    if (docEl && isScrollableElement(docEl)) return docEl;

    return null;
  }

  // 활성 페이지 아래에 아직 보지 않은 영역이 남아 있는지 계산한다.
  // 페이지 자체가 더 길거나, 실제 스크롤 대상이 끝까지 내려가지 않은 경우 모두 true다.
  function hasActivePageMoreBelow(activePage, target) {
    if (!activePage) return false;

    var viewportBottom =
      window.innerHeight || document.documentElement.clientHeight;
    var bodyEl = screenBody.get(0);
    if (bodyEl) {
      viewportBottom = Math.min(
        viewportBottom,
        bodyEl.getBoundingClientRect().bottom,
      );
    }

    var pageRect = activePage.getBoundingClientRect();
    if (pageRect.bottom > viewportBottom + 24) return true;

    if (!target) return false;

    var scrollTop = getScrollTop(target);
    var clientHeight = getClientHeight(target);
    var scrollHeight = getScrollHeight(target);
    return scrollTop + clientHeight < scrollHeight - 24;
  }

  // window/document와 일반 엘리먼트를 같은 방식으로 다루기 위한 스크롤 유틸리티다.
  function getScrollTop(target) {
    if (!target) return 0;
    if (
      target === window ||
      target === document ||
      target === document.body ||
      target === document.documentElement ||
      target === document.scrollingElement
    ) {
      return window.pageYOffset || document.documentElement.scrollTop || 0;
    }
    return target.scrollTop || 0;
  }

  // 현재 스크롤 대상의 가시 높이를 반환한다.
  function getClientHeight(target) {
    if (!target) return window.innerHeight;
    if (
      target === window ||
      target === document ||
      target === document.body ||
      target === document.documentElement ||
      target === document.scrollingElement
    ) {
      return window.innerHeight;
    }
    return target.clientHeight || window.innerHeight;
  }

  function setAutoplayProgressVisible(visible) {
    $(".autoplay-progress").toggleClass("is-visible", !!visible);
  }

  function shouldShowAutoplayProgress() {
    if (!isSwipe || !swiper || !(autoPlay > 0)) return false;
    if (!swiper.autoplay || !swiper.autoplay.running || swiper.isEnd)
      return false;

    var activeIndex =
      typeof swiper.realIndex === "number"
        ? swiper.realIndex
        : swiper.activeIndex;
    if (typeof activeIndex !== "number" || activeIndex < 0) return false;

    return process[activeIndex] === 1;
  }

  function updateAutoplayProgressVisibility() {
    setAutoplayProgressVisible(shouldShowAutoplayProgress());
  }

  // 현재 스크롤 대상의 전체 콘텐츠 높이를 반환한다.
  function getScrollHeight(target) {
    if (!target) return 0;
    if (
      target === window ||
      target === document ||
      target === document.body ||
      target === document.documentElement ||
      target === document.scrollingElement
    ) {
      var doc = document.documentElement;
      var body = document.body;
      return Math.max(
        doc ? doc.scrollHeight : 0,
        body ? body.scrollHeight : 0,
        document.scrollingElement ? document.scrollingElement.scrollHeight : 0,
      );
    }
    return target.scrollHeight || 0;
  }

  // more 버튼 클릭 시 다음 위치로 부드럽게 이동시킨다.
  function scrollToTop(target, top) {
    if (!target) return;
    if (
      target === window ||
      target === document ||
      target === document.body ||
      target === document.documentElement ||
      target === document.scrollingElement
    ) {
      window.scrollTo({ top: top, behavior: "smooth" });
      return;
    }

    if (typeof target.scrollTo === "function") {
      target.scrollTo({ top: top, behavior: "smooth" });
    } else {
      target.scrollTop = top;
    }
  }

  function scrollQuizResultIntoView(parent) {
    if (!parent || parent.length === 0) return;

    var resultEl =
      parent.children(".result").get(0) ||
      parent.find(".result").first().get(0);
    if (!resultEl) return;

    setTimeout(function () {
      if (typeof resultEl.scrollIntoView === "function") {
        resultEl.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        });
      }

      requestAnimationFrame(function () {
        var target = getPageMoreScrollTarget();
        var margin = 20;
        var nextTop = 0;
        var resultRect = resultEl.getBoundingClientRect();

        if (
          !target ||
          target === window ||
          target === document ||
          target === document.body ||
          target === document.documentElement ||
          target === document.scrollingElement
        ) {
          nextTop =
            getScrollTop(document.scrollingElement) + resultRect.top - margin;
          scrollToTop(document.scrollingElement, Math.max(0, nextTop));
          return;
        }

        var targetRect = target.getBoundingClientRect();
        nextTop =
          getScrollTop(target) + (resultRect.top - targetRect.top) - margin;
        scrollToTop(target, Math.max(0, nextTop));
      });
    }, 40);
  }

  // more 버튼 노출 여부를 현재 활성 페이지 상태에 맞춰 갱신한다.
  function updatePageMoreIndicator() {
    var indicator = ensurePageMoreIndicator();
    var target = getPageMoreScrollTarget();
    var activePage = $("[data-page-id].active").first().get(0);

    if (
      !activePage ||
      $("#root").hasClass("menu-hide") ||
      (isIOSDevice && isIOSVideoFullscreen) ||
      document.fullscreenElement
    ) {
      indicator.removeClass("show");
      return;
    }

    var hasMoreBelow = hasActivePageMoreBelow(activePage, target);

    indicator.toggleClass("show", !!hasMoreBelow);
  }

  // 이미지/iframe 레이아웃이 늦게 확정되는 경우를 고려해 여러 타이밍에 재평가한다.
  function schedulePageMoreIndicatorUpdate() {
    clearTimeout(pageMoreIndicatorTimer);
    if (isIOSDevice && isIOSVideoFullscreen) {
      ensurePageMoreIndicator().removeClass("show");
      return;
    }
    updatePageMoreIndicator();

    requestAnimationFrame(function () {
      updatePageMoreIndicator();
      requestAnimationFrame(function () {
        updatePageMoreIndicator();
      });
    });

    pageMoreIndicatorTimer = setTimeout(function () {
      updatePageMoreIndicator();
    }, 120);
  }

  // 활성 페이지가 실제로 보이는 세로 영역을 계산한다.
  // screen_body, page-item, fullscreen 상태가 섞여도 자동완료 기준이 흔들리지 않게 하기 위한 값이다.
  function getActivePageViewportBounds() {
    var viewportTop = 0;
    var viewportBottom =
      window.innerHeight || document.documentElement.clientHeight || 0;
    var activePage = $("[data-page-id].active").first().get(0);
    var bodyEl = screenBody.get(0);

    if (bodyEl) {
      var bodyRect = bodyEl.getBoundingClientRect();
      viewportTop = Math.max(viewportTop, bodyRect.top);
      viewportBottom = Math.min(viewportBottom, bodyRect.bottom);
    }

    if (activePage) {
      var pageRect = activePage.getBoundingClientRect();
      viewportTop = Math.max(viewportTop, pageRect.top);
      viewportBottom = Math.min(viewportBottom, pageRect.bottom);
    }

    return {
      top: viewportTop,
      bottom: viewportBottom,
    };
  }

  // 활성 페이지의 load/DOM 변화를 감시해 more 버튼과 근접 자동완료를 다시 계산한다.
  function observeActivePageMoreChanges(pageEl) {
    if (pageMoreObserver) {
      pageMoreObserver.disconnect();
      pageMoreObserver = null;
    }
    if (pageMoreObservedPage) {
      pageMoreObservedPage.removeEventListener(
        "load",
        pageMoreObservedLoadHandler,
        true,
      );
      pageMoreObservedPage = null;
      pageMoreObservedLoadHandler = null;
    }
    if (!pageEl || !("MutationObserver" in window)) return;

    pageMoreObservedPage = pageEl;
    pageMoreObservedLoadHandler = function () {
      if (isIOSDevice && isIOSVideoFullscreen) return;
      autoCompleteNearFitModules();
      schedulePageMoreIndicatorUpdate();
    };
    pageMoreObservedPage.addEventListener(
      "load",
      pageMoreObservedLoadHandler,
      true,
    );
    pageMoreObserver = new MutationObserver(function () {
      if (isIOSDevice && isIOSVideoFullscreen) return;
      autoCompleteNearFitModules();
      schedulePageMoreIndicatorUpdate();
    });
    pageMoreObserver.observe(pageEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "src"],
    });
  }

  // 외부 HTML 모듈은 고유 콜백 이름을 전달해 iframe에서 부모 창으로 진행률을 올린다.
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

  // 페이지별 모듈 목록과 모듈의 초기 상태를 수집한다.
  $("#screen_body [data-page-id]").each(function (i, v) {
    var mods = [];
    var pageId = $(v).attr("data-page-id");
    var passiveModuleElements = [];
    $(v)
      .find("[data-mod-id]")
      .each((ix, el) => {
        var mid = $(el).attr("data-mod-id");
        var isAct = $(el).find(
          "video,audio,.module-slide.active,.module-quiz,[data-html-src],[data-extra]",
        ).length;
        mods.push(mid);
        modulePageIndexMap[mid] = i;
        if (!isAct) {
          passiveModuleElements.push(el);
        }
        if (!moduleExtra[mid]) {
          moduleExtra[mid] = { act: !!isAct, process: 0 };
        }
      });

    pageIds.push(pageId);
    moduleIds.push(mods);
    pageModuleMap[pageId] = mods;
    pagePassiveModuleElementsMap[pageId] = passiveModuleElements;
  });

  menus.each(function (i, el) {
    var menuPageId = $(el).attr("data-page-id");
    if (menuPageId) {
      menuElementMap[menuPageId] = el;
    }
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

    // 전체 페이지 평균을 현재 학습 진도로 사용한다.
    let max = menus.length;
    let rate = 0;
    for (let i = 0; i < max; i++) {
      rate += process[i] || 0;
    }
    totalProcessSum = rate;

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

  // suspend_data 저장은 디바운스 처리하고, 페이지 종료 직전에는 즉시 한 번 더 저장한다.
  var _suspendDataTimer = null;
  function _saveSuspendDataNow() {
    ScormSet("cmi.suspend_data", JSON.stringify(moduleExtra));
  }
  function _saveSuspendDataDebounced() {
    clearTimeout(_suspendDataTimer);
    _suspendDataTimer = setTimeout(_saveSuspendDataNow, 300);
  }
  window.addEventListener("beforeunload", function () {
    clearTimeout(_suspendDataTimer);
    _saveSuspendDataNow();
  });

  // ===== Module Progress / Completion / Sequential Navigation =====
  // process는 감소시키지 않고 최대값만 유지해 되감기나 재생 위치 변경으로 진도가 후퇴하지 않게 한다.
  function setModuleExtra(mid, val) {
    var currentPageModules = pageModuleMap[pageIndex] || [];
    const lastModuleId =
      currentPageModules.length > 0
        ? currentPageModules[currentPageModules.length - 1]
        : undefined;

    var currentModuleExtra = moduleExtra[mid];
    var nextProcess =
      typeof val?.process === "number"
        ? Math.max(currentModuleExtra?.process || 0, val.process)
        : currentModuleExtra?.process || 0;
    var hasMeaningfulDelta =
      !currentModuleExtra ||
      Object.keys(val || {}).some(function (key) {
        if (key === "process") {
          return currentModuleExtra.process !== nextProcess;
        }
        return currentModuleExtra[key] !== val[key];
      });

    if (!hasMeaningfulDelta) {
      return;
    }

    if (lastModuleId != mid && currentModuleExtra?.process === nextProcess) {
      var nonProcessKeys = Object.keys(val || {}).filter(function (key) {
        return key !== "process";
      });
      if (nonProcessKeys.length === 0) {
        return;
      }
    }

    if (moduleExtra[mid]) {
      moduleExtra[mid] = {
        ...moduleExtra[mid],
        ...val,
        process: nextProcess,
      };
    } else {
      moduleExtra[mid] = {
        ...val,
        process: nextProcess,
      };
    }

    if (!moduleExtra[mid]) {
      return;
    }
    // 저장은 즉시 연속 호출하지 않고 잠시 모아서 처리한다.
    _saveSuspendDataDebounced();
    renderModuleExtra(mid);
    if (window.swiper)
      window.swiper.allowSlideNext = !isParentFunc("next") && isNextAllow();
  }

  window.setModuleExtra = setModuleExtra;

  // 특정 모듈이 속한 페이지의 평균 진도를 다시 계산한다.
  // 특정 모듈이 속한 페이지의 평균 진도를 다시 계산한다.
  // 페이지 단위 진도/목차 표시/순차학습 잠금은 모두 이 계산 결과를 기준으로 움직인다.
  function renderModuleExtra(mid) {
    var pageIx = modulePageIndexMap[mid];
    if (typeof pageIx !== "number" || !moduleIds[pageIx]) return;

    var sum = 0;
    for (var j = 0; j < moduleIds[pageIx].length; j++) {
      var moduleData = moduleExtra[moduleIds[pageIx][j]];
      sum += moduleData.process || 0;
    }

    var realProcess = sum / moduleIds[pageIx].length;
    setProcess(pageIx, realProcess);
  }

  // 순차 학습 과정에서는 현재 페이지의 모든 모듈이 완료되어야 다음으로 이동할 수 있다.
  // 페이지 내 모든 모듈의 process가 1인지 확인한다.
  // 목차 완료 아이콘과 순차학습 next 허용 여부는 이 함수 기준으로 맞춘다.
  function isPageComplete(pageId) {
    var modules = pageModuleMap[pageId] || [];
    for (var i = 0; i < modules.length; i++) {
      var me = moduleExtra[modules[i]];
      if ((me ? me.process : 0) !== 1) return false;
    }
    return true;
  }

  // 현재 페이지 완료 여부를 기준으로 다음 페이지 이동 가능 상태를 반환한다.
  function isNextAllow() {
    return !base?.sequential || !!base?.preview || isPageComplete(pageIndex);
  }

  window.isNextAllow = isNextAllow;

  // 순차학습 과정에서 목표 페이지로 실제 이동 가능한지 검사한다.
  // 앞으로 이동할 때는 현재 페이지부터 목표 직전 페이지까지 모두 완료돼 있어야 한다.
  function canMoveToPage(index) {
    if (!base?.sequential || base?.preview) return true;

    var currentIx = pageIds.indexOf(pageIndex);
    var targetIx = pageIds.indexOf(index);
    if (currentIx < 0 || targetIx < 0) return true;
    if (targetIx <= currentIx) return true;

    for (var ix = currentIx; ix < targetIx; ix++) {
      if (!isPageComplete(pageIds[ix])) return false;
    }

    return true;
  }

  // 페이지 단위 진도를 갱신하고 SCORM 반영 큐를 실행한다.
  // 페이지 단위 진도를 반영하고, SCORM 저장 큐와 목차 UI를 함께 갱신한다.
  function setProcess(id, value) {
    if (value !== 1 && process[id] === value) return;
    var prevValue = process[id] || 0;
    process[id] = value;
    totalProcessSum += value - prevValue;

    if (!!queues.find((x) => x.id === id && x.value === value)) return;

    queues.push({ id, value });
    runQueue();

    reloadProcess(id);
    if (
      pageIds[id] === pageIndex &&
      value === 1 &&
      swiper &&
      autoPlay &&
      id < pageIds.length - 1
    ) {
      swiper.autoplay.timeLeft = 3000;
      swiper.autoplay.resume();
      updateAutoplayProgressVisibility();
    }

    console.log("setProcess", id, value, isParentFunc("next"), isNextAllow());
    setTimeout(() => {
      if (value === 1 && window.swiper)
        window.swiper.allowSlideNext = !isParentFunc("next") && isNextAllow();
    }, 500);
  }

  // 오른쪽 목차의 progress bar와 완료 아이콘 상태를 현재 process 배열 기준으로 다시 그린다.
  function reloadProcess(targetIndex) {
    var hasTargetIndex = typeof targetIndex === "number";
    var start = hasTargetIndex ? targetIndex : 0;
    var end = hasTargetIndex ? targetIndex + 1 : menuElements.length;

    for (var i = start; i < end; i++) {
      var el = menuElements[i];
      if (!el) continue;
      var percent = process[i] || 0;
      var bar = el.querySelector(".bar");
      if (bar) {
        bar.style.setProperty("--progress", percent);
      }
      $(el).toggleClass("finish", isPageComplete(pageIds[i]));
    }
  }

  function scrollActiveMenuIntoView(immediate) {
    var activeMenu = menuElementMap[pageIndex];
    if (!activeMenu) return;

    var menuScroller =
      $(".index-list").get(0) ||
      $("#root > .aside > ul").get(0) ||
      activeMenu.parentElement;
    if (!menuScroller) return;

    var menuTop = activeMenu.offsetTop;
    var menuBottom = menuTop + activeMenu.offsetHeight;
    var viewTop = menuScroller.scrollTop;
    var viewBottom = viewTop + menuScroller.clientHeight;
    var padding = 20;

    if (menuTop >= viewTop + padding && menuBottom <= viewBottom - padding) {
      return;
    }

    var nextTop =
      menuTop -
      Math.max((menuScroller.clientHeight - activeMenu.offsetHeight) / 2, 0);

    if (typeof menuScroller.scrollTo === "function") {
      menuScroller.scrollTo({
        top: Math.max(0, nextTop),
        behavior: immediate ? "auto" : "smooth",
      });
    } else {
      menuScroller.scrollTop = Math.max(0, nextTop);
    }
  }

  // ===== Page Lifecycle / Asset Binding =====
  reloadProcess();

  // SCORM 값은 이전 기록과 비교해 바뀐 경우에만 다시 저장한다.
  var _lastFinalRate = null;
  var _lastCompletionStatus = null;

  function runQueue() {
    if (isQueue) return;
    if (queues.length === 0) {
      isQueue = false;
      return;
    }
    isQueue = true;
    var item = queues[0];
    queues.splice(0, 1);

    // 페이지별 objective 진행률을 먼저 반영한다.
    ScormSet("cmi.objectives." + item.id + ".progress_measure", item.value);

    var max = menus.length;
    var finalRate = totalProcessSum / (max + 0.0);
    var completionStatus = finalRate >= 1 ? "completed" : "incomplete";

    // 최종 진도와 완료 상태는 값이 실제로 바뀐 경우에만 저장한다.
    if (finalRate !== _lastFinalRate) {
      ScormSet("cmi.progress_measure", finalRate);
      _lastFinalRate = finalRate;
    }
    if (completionStatus !== _lastCompletionStatus) {
      ScormSet("cmi.completion_status", completionStatus);
      _lastCompletionStatus = completionStatus;
    }

    setTimeout(function () {
      isQueue = false;
      runQueue();
    }, 300);
  }

  // 반응형 iframe 높이 조정
  function onResize() {
    var w = window.innerWidth;
    if (w >= 768) w = w - 240;
    w = Math.min(w, 1040) - 40;
    $("iframe.youtube").attr("height", w * (3 / 5));
    $("iframe.docs").attr("height", w);
    if (isIOSDevice && typeof window.refreshActivePageImages === "function") {
      window.refreshActivePageImages(false);
    }
  }

  $(window).on("resize", onResize);
  onResize();
  $(window).on("resize", schedulePageMoreIndicatorUpdate);
  ensurePageMoreIndicator();

  var _loc = ScormGet("cmi.location") || "0_0";
  var pageIndex = _loc || pageIdItems.attr("data-page-id");
  $("[data-page-id='" + pageIndex + "']").addClass("active");
  setTimeout(function () {
    scrollActiveMenuIntoView(true);
  }, 0);

  // 현재 페이지를 바꾸고 마지막 위치를 SCORM에 저장한다.
  // 현재 페이지를 전환하고, 페이지 진입 시 필요한 후처리를 한 번에 수행한다.
  function setPageIndex(index) {
    if (!canMoveToPage(index)) return;

    ScormSet("cmi.location", index);
    pageIndex = index;
    pageIdItems.removeClass("active");
    $("[data-page-id='" + index + "']").addClass("active");
    updateSwipeNavigationVisibility();
    scrollActiveMenuIntoView();
    autoCompleteNearFitModules();
    onScroll({ target: screenBody.get(0) });
    schedulePageMoreIndicatorUpdate();
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

  // 큰 이미지는 캔버스로 축소해 메모리 사용량을 줄인다.
  // iOS Safari에서는 이 과정이 오히려 메모리 피크를 만들 수 있어 수행하지 않는다.
  // SVG, GIF, base64 이미지는 제외한다.
  var _IMG_MAX_PX = 1920;
  var _pageImageObserver = null;
  var _pageImageTrimTimer = null;
  var _pageImageRefreshTimer = null;
  function _resizeImageIfOversized(img) {
    if (img.getAttribute("data-resized")) return;
    if (isIOSDevice) return;

    function doResize() {
      var nw = img.naturalWidth;
      var nh = img.naturalHeight;
      if (!nw || !nh) return;
      if (nw <= _IMG_MAX_PX && nh <= _IMG_MAX_PX) return;

      var src = img.src || "";
      // base64, SVG, GIF 이미지는 축소 대상에서 제외한다.
      if (src.startsWith("data:")) return;
      if (/\.(svg|gif)(\?|#|$)/i.test(src)) return;
      if (!img.getAttribute("data-origin-src")) {
        img.setAttribute("data-origin-src", src);
      }

      var ratio = Math.min(_IMG_MAX_PX / nw, _IMG_MAX_PX / nh);
      try {
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(nw * ratio);
        canvas.height = Math.round(nh * ratio);
        canvas
          .getContext("2d")
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src = canvas.toDataURL("image/jpeg", 0.82);
        img.setAttribute("data-resized", "1");
        // 캔버스 버퍼를 비워 메모리를 빨리 반환하도록 유도한다.
        canvas.width = 0;
        canvas.height = 0;
        console.log(
          "[img-resize]",
          canvas.width + "x" + canvas.height,
          "->",
          Math.round(nw * ratio) + "x" + Math.round(nh * ratio),
        );
      } catch (e) {
        console.warn("[img-resize] failed:", e);
      }
    }

    if (img.complete && img.naturalWidth > 0) {
      doResize();
    } else {
      img.addEventListener("load", doResize, { once: true });
    }
  }

  function _loadPageImage(img) {
    if (!img || !img.getAttribute("data-src")) return;
    var $img = $(img);
    $img.attr("src", $img.attr("data-src")).removeAttr("data-src");
    _resizeImageIfOversized(img);
  }

  function _disconnectPageImageObserver() {
    if (_pageImageObserver) {
      _pageImageObserver.disconnect();
      _pageImageObserver = null;
    }
  }

  // iOS에서는 실제 스크롤 컨테이너를 root로 써서 화면 근처 이미지만 제한적으로 로드한다.
  function _getPageImageObserverRoot() {
    var target = getPageMoreScrollTarget();
    if (
      target &&
      target !== window &&
      target !== document &&
      target !== document.body &&
      target !== document.documentElement &&
      target !== document.scrollingElement
    ) {
      return target;
    }
    return null;
  }

  function _observePageImages(nowPage) {
    _disconnectPageImageObserver();
    if (!isIOSDevice || !("IntersectionObserver" in window)) return;

    var imgs = nowPage.find("img[data-src]").toArray();
    if (!imgs.length) return;
    var observerRoot = _getPageImageObserverRoot();
    var eagerCount = 1;

    _pageImageObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          _loadPageImage(entry.target);
          if (_pageImageObserver) {
            _pageImageObserver.unobserve(entry.target);
          }
        });
      },
      {
        root: observerRoot,
        rootMargin: observerRoot ? "80px 0px 140px 0px" : "120px 0px 180px 0px",
        threshold: 0.01,
      },
    );

    imgs.forEach(function (img, index) {
      if (index < eagerCount) {
        _loadPageImage(img);
        return;
      }
      _pageImageObserver.observe(img);
    });
  }

  function _trimActivePageImages(nowPage, forceReset, shouldReobserve) {
    if (!isIOSDevice || !nowPage || !nowPage.length) return;
    if (typeof shouldReobserve === "undefined") shouldReobserve = true;

    var viewportBottom =
      window.innerHeight || document.documentElement.clientHeight || 0;
    var keepMargin = forceReset ? 120 : Math.max(viewportBottom * 1.2, 420);

    nowPage.find("img").each(function () {
      var img = this;
      var rect = img.getBoundingClientRect();
      var originSrc =
        img.getAttribute("data-origin-src") || img.getAttribute("src");
      if (!originSrc || originSrc.startsWith("data:")) return;

      var isFar =
        rect.bottom < 0 - keepMargin || rect.top > viewportBottom + keepMargin;

      if (forceReset || isFar) {
        if (img.getAttribute("src")) {
          $(img)
            .attr("data-src", originSrc)
            .attr("data-origin-src", originSrc)
            .removeAttr("src")
            .removeAttr("data-resized");
        }
        if (_pageImageObserver) {
          _pageImageObserver.unobserve(img);
        }
      }
    });

    if (shouldReobserve) {
      _observePageImages(nowPage);
    }
  }

  function _scheduleTrimActivePageImages(nowPage, forceReset) {
    if (!isIOSDevice || !nowPage || !nowPage.length) return;
    clearTimeout(_pageImageTrimTimer);
    _pageImageTrimTimer = setTimeout(
      function () {
        _trimActivePageImages(nowPage, !!forceReset);
      },
      forceReset ? 60 : 120,
    );
  }

  // 현재 페이지의 이미지만 복원한다. iOS에서는 배치 단위로 나눠 붙인다.
  function _restorePageImages(nowPage) {
    var imgs = nowPage.find("img[data-src]").toArray();
    if (!isIOSDevice) {
      imgs.forEach(function (img) {
        _loadPageImage(img);
      });
      return;
    }

    _observePageImages(nowPage);
    _scheduleTrimActivePageImages(nowPage, false);
  }

  // 현재 페이지가 아닌 이미지들은 다시 data-src로 돌려 메모리를 해제한다.
  function _releaseInactivePageImages(id) {
    $("[data-page-id]:not([data-page-id='" + id + "']) img[src]").each(
      function () {
        var $img = $(this);
        var src = $img.attr("src");
        var originSrc = $img.attr("data-origin-src") || src;
        if (!originSrc || originSrc.startsWith("data:")) return;

        $img
          .attr("data-src", originSrc)
          .attr("data-origin-src", originSrc)
          .removeAttr("src")
          .removeAttr("data-resized");
      },
    );
  }

  // 활성 페이지에 필요한 리소스(이미지/비디오)만 붙이고 관련 옵저버를 연결한다.
  function pageShowed(id) {
    var nowPage = $("[data-page-id='" + id + "']");
    observeActivePageMoreChanges(nowPage.get(0));

    // 보이지 않는 페이지의 이미지는 다시 언로드한다.
    _releaseInactivePageImages(id);

    // 현재 페이지의 이미지를 복원하고 필요하면 축소본으로 교체한다.
    _restorePageImages(nowPage);

    // 비디오는 현재 페이지 진입 시점에만 실제 src를 붙인다.
    nowPage.find("video source:not([src])").each(function (v, el) {
      $(el).attr("src", $(el).attr("data-src"));
    });
    nowPage.find("video:not([src])").each(function (v, el) {
      $(el).attr("src", $(el).attr("data-src"));
    });
    nowPage.find("video").addClass("applyed");
    videoInit(nowPage);
    _scheduleTrimActivePageImages(nowPage, false);
    schedulePageMoreIndicatorUpdate();
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

  window.refreshActivePageImages = function (forceReset) {
    if (!isIOSDevice) return;
    if (isIOSVideoFullscreen || isIOSRotating) {
      iosPendingImageRefresh = true;
      iosPendingImageRefreshForce = iosPendingImageRefreshForce || !!forceReset;
      return;
    }
    clearTimeout(_pageImageRefreshTimer);
    _pageImageRefreshTimer = setTimeout(
      function () {
        var activePage = $("[data-page-id='" + pageIndex + "']");
        if (!activePage.length) return;
        _releaseInactivePageImages(pageIndex);
        _trimActivePageImages(activePage, !!forceReset);
      },
      forceReset ? 260 : 80,
    );
  };

  // 화면이 Swiper 모드면 슬라이드 이동과 페이지 진도를 연동한다.
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
          if (!progressCircle || !progressContent) return;
          progressCircle.style.setProperty("--progress", 1 - progress);
          progressContent.textContent = `${Math.ceil(time / 1000)}s`;
          updateAutoplayProgressVisibility();
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

    // 자동 넘김은 페이지 완료 여부와 함께 제어한다.
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
    updateSwipeNavigationVisibility();

    swiper.on("slideChange", function ({ realIndex, isEnd, previousIndex }) {
      var nextPageId = pageIds[realIndex];
      if (!canMoveToPage(nextPageId)) {
        swiper.allowSlideNext = false;
        setTimeout(function () {
          swiper.slideTo(previousIndex);
        }, 0);
        alert(NOT_ALLOWED_NEXT_MSG);
        return;
      }

      if (autoPlay > 0) {
        if (process[realIndex] !== 1 || isEnd) {
          swiper.autoplay.pause(false, true);
          updateAutoplayProgressVisibility();
        } else {
          updateAutoplayProgressVisibility();
        }
      } else {
        updateAutoplayProgressVisibility();
      }
      setPageIndex(nextPageId);
      setProcess(realIndex, process[realIndex]);
      var prevPage = $("[data-page-id='" + pageIds[previousIndex] + "']");
      if (prevPage.find("video,audio")) {
        prevPage.find("video,audio").each(function (ix, el) {
          el.pause();
        });
      }
      swiper.allowSlideNext = !isParentFunc("next") && !isEnd && isNextAllow();
      pageShowed(pageIds[realIndex]);
      updateSwipeNavigationVisibility();
      schedulePageMoreIndicatorUpdate();
    });
    if (swiper.autoplay && typeof swiper.autoplay.pause === "function") {
      swiper.autoplay.pause();
    }
    updateAutoplayProgressVisibility();
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
  updateSwipeNavigationVisibility();

  // 내부 슬라이드형 모듈도 별도 진행률로 저장한다.
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

  // 좌측 메뉴 열기/닫기
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

  // 메뉴 클릭 이동도 순차 학습 제약을 동일하게 적용한다.
  menus.click(function () {
    var id = $(this).attr("data-page-id");
    if (!isSwipe || !swiper) {
      if (!canMoveToPage(id)) {
        alert(NOT_ALLOWED_NEXT_MSG);
        return;
      }
      setPageIndex(id);
    } else {
      if (!canMoveToPage(id)) {
        alert(NOT_ALLOWED_NEXT_MSG);
        return;
      }
      var realIndex = pageIds.indexOf(id);
      swiper.slideTo(realIndex);
    }
  });

  // ===== Passive Module Auto-complete =====
  // 화면 안에 실제로 들어온 비상호작용 모듈만 자동 완료 처리한다.
  // act=false 모듈만 대상으로 하며, 보이는 영역 계산은 활성 페이지의 실제 viewport를 기준으로 한다.
  function completeVisiblePassiveModules() {
    var viewportBounds = getActivePageViewportBounds();
    var passiveModules = pagePassiveModuleElementsMap[pageIndex] || [];
    passiveModules.forEach(function (el) {
      var p = el.getBoundingClientRect();
      if (
        p.bottom <= viewportBounds.bottom + 20 &&
        p.top < viewportBounds.bottom
      ) {
        var mid = $(el).attr("data-mod-id");
        if (!moduleExtra[mid].act) setModuleExtra(mid, { process: 1 });
      }
    });
  }

  // near-fit 자동완료는 단일 passive 모듈 페이지에서만 허용한다.
  // 여러 이미지 모듈이 한 페이지에 있을 때 진입 직후 전체 완료로 찍히는 오탐을 막기 위한 제한이다.
  function canAutoCompleteNearFitPage() {
    var activePage = $(".page-item.active");
    if (!activePage.length) return false;

    var moduleBlocks = activePage.find("[data-mod-id]");
    if (moduleBlocks.length !== 1) return false;

    var moduleEl = moduleBlocks.first();
    var mid = moduleEl.attr("data-mod-id");
    if (!mid || !moduleExtra[mid] || moduleExtra[mid].act) return false;

    // 단일 이미지처럼 "거의 다 보이는 정적 페이지"만 예외 처리한다.
    // 페이지 전체 기준으로 이미지가 여러 장이면 실제 스크롤을 요구한다.
    if (activePage.find("img").length > 1) return false;

    return true;
  }

  // 스크롤이 거의 필요 없는 페이지(overflow 20px 미만)는 진입 시 바로 자동 완료한다.
  // 사용자가 체감상 "다 본 페이지"인데 1~19px 차이로 progress가 안 오르는 문제를 막기 위한 예외 규칙이다.
  function autoCompleteNearFitModules() {
    if (isIOSDevice && isIOSVideoFullscreen) return;
    var target = getPageMoreScrollTarget();
    var overflow = target
      ? getScrollHeight(target) - getClientHeight(target)
      : 0;
    if (
      canAutoCompleteNearFitPage() &&
      target &&
      overflow > 0 &&
      overflow < 30
    ) {
      completeVisiblePassiveModules();
    }
  }

  // 화면에 들어온 비상호작용 모듈은 자동 완료 처리한다.
  // 사용자 스크롤 시 비상호작용 모듈 자동완료와 more 버튼 갱신을 함께 처리한다.
  function onScroll(e) {
    if (e && e.type === "scroll") {
      completeVisiblePassiveModules();
    }
    if (isIOSDevice && typeof window.refreshActivePageImages === "function") {
      window.refreshActivePageImages(false);
    }
    schedulePageMoreIndicatorUpdate();
  }

  // 스크롤 이벤트는 스로틀링해 과도한 계산을 줄인다.
  var _scrollThrottleTimer = null;
  var _pendingScrollEvent = null;
  // 스크롤 이벤트를 스로틀링해 과도한 DOM 계산을 줄인다.
  function onScrollThrottled(e) {
    _pendingScrollEvent = e;
    if (_scrollThrottleTimer) return;
    _scrollThrottleTimer = setTimeout(function () {
      _scrollThrottleTimer = null;
      onScroll(_pendingScrollEvent);
      _pendingScrollEvent = null;
    }, 150);
  }
  document.addEventListener(
    "scroll",
    onScrollThrottled,
    true /*Capture event*/,
  );
  screenBody.on("scroll", schedulePageMoreIndicatorUpdate);

  const intervalTargets = [];
  // 재생 중인 미디어의 진행 시간을 주기적으로 저장한다.
  setInterval(function () {
    for (var target of intervalTargets) {
      var mid = $(target).parents("[data-mod-id]").attr("data-mod-id");
      var nCurr = moduleExtra[mid] ? moduleExtra[mid].currentTime || 0 : 0;
      var currentTime = Math.max(target.currentTime, nCurr);
      var process = currentTime / target.duration;
      setModuleExtra(mid, { process, currentTime: currentTime });
    }
  }, 20000);

  // 복수 선택형 퀴즈 값 수집
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

  // 퀴즈 답안을 저장하고 정답 여부를 계산한다.
  function getQuizAnswers(parent) {
    var answers = [];
    try {
      answers = JSON.parse(parent.find("textarea").val());
    } catch (e) {
      var value = parent.find("textarea").val()?.trim() || "";
      if (value.startsWith("[")) value = value.substring(1, value.length);
      if (value.endsWith("]")) value = value.substring(0, value.length - 1);
      answers = value ? value.split(",") : [];
    }
    return answers.map(function (v) {
      return String(v).trim();
    });
  }

  function updateQuizModuleVisualState(parent, state, answers, vals) {
    if (!parent || parent.length === 0) return;

    var normalizedAnswers = (answers || []).map(function (v) {
      return String(v).trim();
    });
    var normalizedVals = (vals || []).map(function (v) {
      return String(v).trim();
    });
    var hasSelection = normalizedVals.length > 0 && normalizedVals[0] !== "";

    parent.toggleClass("has-selection", hasSelection);

    parent
      .find(".quiz-ul-select li > label, .quiz-ox-select label")
      .each(function () {
        var label = $(this);
        var input = label.find("input").first();
        var value = String(input.val() || "").trim();
        var isSelected = input.prop("checked");
        var isAnswer = normalizedAnswers.indexOf(value) > -1;

        label.toggleClass("is-selected", isSelected);
        label.toggleClass("is-answer", !!state && isAnswer);
        label.toggleClass(
          "is-missed-answer",
          state === "fail" && isAnswer && !isSelected,
        );
        label.toggleClass(
          "is-wrong-selection",
          state === "fail" && isSelected && !isAnswer,
        );
        label.toggleClass("is-correct-selection", state === "ok" && isSelected);
      });
  }

  function setQuizValue(mid, vs) {
    var p = $(".module-quiz[data-mod-valcheck='" + mid + "']");
    var answers = getQuizAnswers(p);
    var state = "fail";
    if (p.find(".quiz-ul-select")?.length > 0) {
      // 다중 선택형
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
      // 주관식 또는 OX

      if (
        !!answers.find((x) => {
          var uv = vs[0];
          const u = String(uv)
            .toLowerCase()
            .replace(/[^0-9a-z가-힣]/g, "");
          const oo = String(x)
            .toLowerCase()
            .replace(/[^0-9a-z가-힣]/g, "");
          return oo === u;
        })
      ) {
        state = "ok";
      }
    }

    setModuleExtra(mid, { process: 1, vals: vs, val: vs[0], state });
    quizRender();
    scrollQuizResultIntoView(p);
  }

  window.setQuizValue = setQuizValue;

  // 단일 입력형 퀴즈 처리
  function setQuizVal(o) {
    var parent = $(o).parents("[data-mod-valcheck]");
    var uv = o.value;
    var answers = getQuizAnswers(parent);

    var state = "fail";
    if (
      !!answers.find((x) => {
        const oo = String(x)
          .toLowerCase()
          .replace(/[^0-9a-z가-힣]/g, "");
        const u = String(uv)
          .toLowerCase()
          .replace(/[^0-9a-z가-힣]/g, "");
        return oo === u;
      })
    ) {
      state = "ok";
    }

    var mid = parent.parents("[data-mod-id]").attr("data-mod-id");
    setModuleExtra(mid, { process: 1, val: uv, vals: [uv], state });
    quizRender();
    scrollQuizResultIntoView(parent);
  }

  window.setQuizVal = setQuizVal;

  // 저장된 퀴즈 상태를 화면에 다시 반영한다.
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
        var vals = moduleExtra[key].vals || [];
        if (vals.length === 0 && typeof moduleExtra[key].val !== "undefined") {
          vals = [moduleExtra[key].val];
        }
        if (t === "radio") {
          var val = vals[0];
          $("input[name='answer_" + key + "'][value='" + val + "']").prop(
            "checked",
            true,
          );
        } else if (t === "checkbox") {
          for (var val of vals) {
            $("input[name='answer_" + key + "'][value='" + val + "']").prop(
              "checked",
              true,
            );
          }
        } else {
          var val = vals[0];
          $("input[name='answer_" + key + "']").val(val);
        }
      }

      updateQuizModuleVisualState(
        parent,
        moduleExtra[key].state,
        getQuizAnswers(parent),
        moduleExtra[key].vals ||
          (typeof moduleExtra[key].val !== "undefined"
            ? [moduleExtra[key].val]
            : []),
      );
    }

    $(".module-quiz[data-mod-valcheck]").each(function () {
      var parent = $(this);
      var mid = parent.attr("data-mod-valcheck");
      if (moduleExtra[mid]) return;

      var vals = [];
      parent.find("input:checked").each(function (_, input) {
        vals.push(input.value);
      });
      updateQuizModuleVisualState(parent, "", getQuizAnswers(parent), vals);
    });
  }

  quizRender();
  reloadProcess();

  // 비디오/오디오 플레이어 초기화, 탐색 제한, 워터마크, 자동 재생 제어를 담당한다.
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
          if (base.watermark) {
            ensurePlayerWatermarkOverlay(player.el_);
            refreshPlayerWatermarkOverlays(getWatermarkHtml());
          }
          setTimeout(() => {
            // 빨리감기 금지 과정에서는 저장된 위치보다 앞으로 건너뛰지 못하게 막는다.
            if (!base.videoSeek) {
              player.on("seeking", function (event) {
                let currentTime = !moduleExtra[mid]
                  ? 0
                  : moduleExtra[mid]?.currentTime || 0;
                if (
                  currentTime >= 0 &&
                  currentTime <
                    player.currentTime() - getSafeRequestedScormDiffTime()
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
                    player.currentTime() - getSafeRequestedScormDiffTime()
                ) {
                  player.currentTime(currentTime);
                }
              });
            }

            // 워터마크는 기본적으로 표시하고, iOS 전체화면 전환 시에만 숨긴다.
            if (base.watermark && !isStarbucksWatermark()) {
              for (var i = 0; i < 3; i++) {
                vjs.dynamicWatermark({
                  elementId: "vwm_unique_" + i,
                  changeDuration: 100 * 1000,
                  watermarkText: getWatermarkHtml(),
                  cssText:
                    "font-size: 1rem; " +
                    "z-index: 9999; " +
                    "position: absolute; left: 0px ",
                });
              }
              refreshWatermarkText();
            }
          }, 0);

          if (nowPage) {
            player.currentTime(moduleExtra[mid].currentTime);
          }
          if (
            navigator.userAgent.match(/iPhone|iPad|like Mac OS X/i) &&
            window.document.domain.indexOf("leaders") < 0
          ) {
            var fullscreenEnter = function () {
              if (isIOSVideoFullscreen) return;
              logIOSFullscreenDebug("native-enter", {
                currentPage: pageIndex,
                mid: mid,
              });
              isIOSVideoFullscreen = true;
              resetIOSPlayerControlState(player, true);
              setIOSCustomVideoFullscreen(player.el_, true);
              _disconnectPageImageObserver();
              _releaseInactivePageImages(pageIndex);
              syncIOSVideoFullscreen(true);
            };
            var fullscreenExit = function () {
              if (!isIOSVideoFullscreen) return;
              logIOSFullscreenDebug("native-exit", {
                currentPage: pageIndex,
                mid: mid,
              });
              isIOSVideoFullscreen = false;
              setIOSCustomVideoFullscreen(player.el_, false);
              resetIOSPlayerControlState(player, false);
              syncIOSVideoFullscreen(false);
            };
            var mediaCandidates = [
              el,
              player.tech_ && player.tech_.el_,
              player.el_ && player.el_.querySelector
                ? player.el_.querySelector("video")
                : null,
            ].filter(Boolean);

            if (
              !bindIOSNativeVideoFullscreenEvents(
                mediaCandidates,
                fullscreenEnter,
                fullscreenExit,
              )
            ) {
              logIOSFullscreenDebug("fallback-bind", { mid: mid });
              // iOS 환경인데 native 이벤트를 못 잡는 경우를 대비한 마지막 보조 경로
              vjs.off("fullscreenchange");
              vjs.on("fullscreenchange", function () {
                logIOSFullscreenDebug("vjs-fullscreenchange", {
                  isFullscreen: vjs.isFullscreen(),
                  mid: mid,
                });
                if (vjs.isFullscreen()) {
                  fullscreenEnter();
                } else {
                  fullscreenExit();
                }
              });
            } else {
              logIOSFullscreenDebug("native-bind", {
                mid: mid,
                candidates: mediaCandidates.length,
              });
            }

            var fullscreenButton =
              player.controlBar && player.controlBar.fullscreenToggle
                ? player.controlBar.fullscreenToggle.el()
                : player.el_ && player.el_.querySelector
                  ? player.el_.querySelector(".vjs-fullscreen-control")
                  : null;
            if (
              fullscreenButton &&
              !fullscreenButton.getAttribute("data-ios-fullscreen-assist-bound")
            ) {
              fullscreenButton.setAttribute(
                "data-ios-fullscreen-assist-bound",
                "1",
              );
              var onFullscreenButtonPress = function (event) {
                if (event) {
                  event.preventDefault();
                  event.stopPropagation();
                  if (typeof event.stopImmediatePropagation === "function") {
                    event.stopImmediatePropagation();
                  }
                }
                logIOSFullscreenDebug("fullscreen-button-press", {
                  currentPage: pageIndex,
                  mid: mid,
                });
                if (isIOSVideoFullscreen) {
                  fullscreenExit();
                } else {
                  fullscreenEnter();
                }
              };
              fullscreenButton.addEventListener(
                "touchend",
                onFullscreenButtonPress,
                true,
              );
              fullscreenButton.addEventListener(
                "click",
                onFullscreenButtonPress,
                true,
              );
            }

            ensureIOSFullscreenTapOverlay(player);

            var onIOSPageResume = function () {
              if (!isIOSVideoFullscreen) return;
              var stillFullscreen = mediaCandidates.some(function (candidate) {
                if (!candidate) return false;
                if (candidate.webkitDisplayingFullscreen) return true;
                return (
                  (candidate.webkitPresentationMode || "inline") ===
                  "fullscreen"
                );
              });
              logIOSFullscreenDebug("resume-check", {
                currentPage: pageIndex,
                mid: mid,
                stillFullscreen: stillFullscreen,
              });
              if (!stillFullscreen) {
                fullscreenExit();
              }
            };
            if (!iosFullscreenResumeHandler) {
              iosFullscreenResumeHandler = function () {
                onIOSPageResume();
              };
              window.addEventListener("pageshow", iosFullscreenResumeHandler);
            }
            if (!iosFullscreenVisibilityHandler) {
              iosFullscreenVisibilityHandler = function () {
                if (!document.hidden && iosFullscreenResumeHandler) {
                  iosFullscreenResumeHandler();
                }
              };
              document.addEventListener(
                "visibilitychange",
                iosFullscreenVisibilityHandler,
              );
            }
          }
        });
      });

    setTimeout(() => {
      $("audio, video")
        .off(".lcmsMediaState")
        .on("play.lcmsMediaState", function () {
          // 네임스페이스 이벤트를 사용해 같은 엘리먼트에 중복 등록되지 않게 한다.
          if (intervalTargets.indexOf(this) < 0) intervalTargets.push(this);
          if (autoPlay && swiper) {
            swiper.autoplay.pause();
            updateAutoplayProgressVisibility();
          }
        })
        .on("pause.lcmsMediaState", function () {
          var ix = intervalTargets.indexOf(this);
          if (ix >= 0) intervalTargets.splice(ix, 1);
        })
        .on("ended.lcmsMediaState", function () {
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

  // 오디오도 video.js 스킨으로 통일한다.
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

  // 미디어 요소의 기본 우클릭 메뉴는 막는다.
  $("video, audio").on("contextmenu", function (e) {
    e.preventDefault();
  });

  // 일반 워터마크 영역이 있으면 사용자명과 시각을 표시한다.
  if (base.watermark) {
    startWatermarkRefresh();
  }

  // 부모 프레임이 이전/다음 이동 함수를 제공하는지 확인한다.
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

  schedulePageMoreIndicatorUpdate();
}
