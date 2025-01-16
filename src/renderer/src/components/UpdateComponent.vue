<script setup lang="ts">
import { Modal, Progress } from 'ant-design-vue';
import { onMounted, ref } from 'vue';
const newVersion = ref('');
const isOpen = ref(false);
const isDownloading = ref(false);
const downloadProgress = ref(0);
const isDownloadEnd = ref(false);
const downloadSpeed = ref(0);
const willDownloadTotal = ref(0);

async function handleOkClick() {
  if (!isDownloading.value && !isDownloadEnd.value) {
    isDownloading.value = true;
    downloadProgress.value = 0;
    isDownloadEnd.value = false;
    await window.api.startDownloadUpdate();
  } else if (isDownloadEnd.value) {
    console.log('开始安装');
    await window.api.startInstallUpdate();
  }
}

onMounted(async () => {
  window.electron.ipcRenderer.on(window.api.updaterEventKeys.UPDATE_AVAILABLE, (_, version) => {
    console.log(`最新的版本是：${version}`);
    newVersion.value = version;
    isOpen.value = true;
    newVersion.value = version;
  });

  window.electron.ipcRenderer.on(
    window.api.updaterEventKeys.UPDATE_PROGRESS,
    (_, percent, bytesPerSecond, total) => {
      isDownloading.value = true;
      downloadProgress.value = Math.ceil(percent * 100) / 100;
      downloadSpeed.value = bytesPerSecond;
      willDownloadTotal.value = total;
    }
  );

  window.electron.ipcRenderer.on(window.api.updaterEventKeys.UPDATE_DOWNLOADED, () => {
    downloadProgress.value = 100;
    isDownloadEnd.value = true;
    isDownloading.value = false;
    console.log('下载完成');
  });

  await window.api.checkForUpdate();
});
</script>

<template>
  <Modal
    v-model:open="isOpen"
    wrap-class-name="update-modal-wrapper"
    title="版本更新"
    cancel-text="取消更新"
    centered
    :mask-style="{ zIndex: 90000 }"
    :mask-closable="false"
    :closable="false"
    :ok-text="!isDownloadEnd ? '下载更新' : '立即更新'"
    :footer="isDownloading ? null : undefined"
    @ok="handleOkClick"
  >
    <div v-if="!isDownloading" class="update-info">当前最新版本：{{ newVersion }}</div>
    <div v-else class="progress-wrapper">
      <Progress
        :percent="downloadProgress"
        :status="downloadProgress >= 100 ? 'success' : 'active'"
      />
      <div class="download-status">
        <span v-if="!isDownloadEnd" style="margin-right: 10px">
          下载速度：{{ (downloadSpeed / (1024 * 1024)).toFixed(2) }}mb/s
        </span>
        <span>
          下载进度：{{
            ((willDownloadTotal * (downloadProgress / 100)) / (1024 * 1024)).toFixed(2)
          }}mb / {{ (willDownloadTotal / (1024 * 1024)).toFixed(2) }}mb
        </span>
      </div>
    </div>
  </Modal>
</template>

<style lang="scss">
.update-modal-wrapper {
  z-index: 9000000 !important;

  .update-info {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 80px;
    font-size: 18px;
    color: #333;
  }

  .progress-wrapper {
    width: 100%;
    height: 80px;

    .download-status {
      display: flex;
      flex-flow: row;
      justify-content: flex-end;
      align-items: center;
    }
  }
}
</style>
