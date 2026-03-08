let page_location = window.location.href;
let rule_sets = [];
let session_flag = false;
let logi = console.info;
let logw = console.warn;
let loge = console.error;
let btn_id = "";

// 主逻辑：从存储获取配置并运行拦截
if (chrome.storage && chrome.storage.sync) {
  chrome.storage.sync.get(null, (storage_data) => {
    let config_flag = storage_data.flag;

    if (config_flag) {
      session_flag = true;
    }

    // 只有当是 YouTube 页面且有选择器配置时才运行
    if (page_location.includes("youtube.com") && storage_data.selectors) {
      rule_sets = storage_data.selectors;

      setInterval(() => {
        if (!rule_sets) return;

        // 1. 直接隐藏元素
        let direct_block_list = rule_sets.DirectBlockElements;

        if (direct_block_list) {
          for (let i = 0; i < direct_block_list.length; i++) {
            let block_target = document.querySelector(
              `${direct_block_list[i]}`,
            );

            if (block_target && block_target.style.display != "none") {
              block_target.style.display = "none";
            }
          }
        }

        // 2. 基于文本内容隐藏元素
        let text_block_rules = rule_sets.LoopAndBlockElements;

        if (text_block_rules) {
          for (let i = 0; i < text_block_rules.length; i++) {
            let scan_element = document.querySelector(
              `${text_block_rules[i][0]}`,
            );

            let match_text = text_block_rules[i][1];

            if (scan_element && scan_element.style.display != "none") {
              if (scan_element.innerText.includes(match_text)) {
                scan_element.style.display = "none";
              }
            }
          }
        }

        // 3. 显示提示横幅
        let review_button_status = rule_sets.ElementList
          ? rule_sets.ElementList.reviewBtnStatus
          : "false";

        if (review_button_status == "true" && !config_flag && !session_flag) {
          if (!document.querySelector(".ytblocker")) {
            let player_container = document.querySelector(
              rule_sets.ElementList ? rule_sets.ElementList.player : "#below",
            );

            if (player_container) {
              player_container.prepend(container);
            }
          }
        }

        // 4. 跳过视频广告
        if (rule_sets.ElementList) {
          let ad_indicator = document.querySelector(
            `${rule_sets.ElementList.videoAdFound}`,
          );

          if (ad_indicator) {
            let skip_button = document.querySelector(
              `${rule_sets.ElementList.adskipBtn}`,
            );

            if (skip_button) {
              skip_button.click();
            } else {
              let ad_video = document.querySelector(
                `${rule_sets.ElementList.videoAdFoundVideo}`,
              );

              if (ad_video) {
                ad_video.currentTime = isNaN(ad_video.duration)
                  ? 0
                  : ad_video.duration;
              }
            }
          }
        }
      }, 500);
    }
  });
}

// ---------------------------------------------------------
// 备用逻辑
// ---------------------------------------------------------

const AD_RULES = {
  SKIP_BUTTON: ".ytp-skip-ad-button",
  AD_ACTIVE: ".ad-showing",
  TEXT_LAYER: ".ytp-ad-text-overlay",
  PLAYER_AD_SECTION: "#player-ads",
  SEARCH_AD_SECTION: "#fulfilled-layout",
};

function getElementCenter(element) {
  if (!element) return null;

  const rect = element.getBoundingClientRect();

  const winX = window.screenX || window.screenLeft;
  const winY = window.screenY || window.screenTop;
  const uiHeight = window.outerHeight - window.innerHeight;

  const viewportScreenX = winX;
  const viewportScreenY = winY + uiHeight;

  let x = viewportScreenX + rect.left + rect.width / 2;
  let y = viewportScreenY + rect.top + rect.height / 2;

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

const ad_handlers = {
  click_skip: (node) => {
    if (btn_id == node.id || node.style.display == "none") {
      return;
    }
    btn_id = node.id;
    let cord = getElementCenter(node);
    chrome.runtime.sendMessage({
      type: "COORDS_READY",
      x: cord.x,
      y: cord.y,
    });
    //ad_handlers.fast_forward();
  },

  fast_forward: () => {
    const ad_video = document.querySelector(`${AD_RULES.AD_ACTIVE} video`);

    if (ad_video && ad_video.duration) {
      if (ad_video.duration > 20) {
        ad_video.currentTime = ad_video.duration - 5.0;
      } else {
        ad_video.currentTime = ad_video.duration - 1.0;
      }
    }
  },

  remove_node: (node) => {
    node.remove();
  },
};

const scan_youtube_ads = () => {
  const action_list = [
    { selector: AD_RULES.SKIP_BUTTON, handler: ad_handlers.click_skip },
    { selector: AD_RULES.AD_ACTIVE, handler: ad_handlers.fast_forward },
    { selector: AD_RULES.TEXT_LAYER, handler: ad_handlers.remove_node },
    { selector: AD_RULES.PLAYER_AD_SECTION, handler: ad_handlers.remove_node },
    { selector: AD_RULES.SEARCH_AD_SECTION, handler: ad_handlers.remove_node },
  ];

  action_list.forEach(({ selector, handler }) => {
    const node = document.querySelector(selector);

    if (node) {
      handler(node);
    }
  });
};

const launch_ad_blocker = (delay = 1000) => {
  return setInterval(scan_youtube_ads, delay);
};

class youtube_ad_blocker {
  constructor(delay = 1000) {
    this.delay = delay;
    this.active = false;
    this.timer_id = null;
  }

  async start() {
    if (this.active) return;

    this.active = true;
    this.execute();
  }

  stop() {
    this.active = false;

    if (this.timer_id) {
      clearTimeout(this.timer_id);
    }
  }

  async execute() {
    if (!this.active) return;

    try {
      scan_youtube_ads();
    } catch (error) {
      logw("Ad blocker error:", error);
    }

    this.timer_id = setTimeout(() => this.execute(), this.delay);
  }
}

// 启动备用广告拦截
const blocker_interval = launch_ad_blocker();
const blocker_instance = new youtube_ad_blocker(1000);

blocker_instance.start();
