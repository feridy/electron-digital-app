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
  window.electron.ipcRenderer.on('UPDATE_AVAILABLE', (_, version) => {
    console.log(version);
    newVersion.value = version;
    isOpen.value = true;
    newVersion.value = version;
  });

  window.electron.ipcRenderer.on('UPDATE_PROGRESS', (_, percent, bytesPerSecond, total) => {
    isDownloading.value = true;
    downloadProgress.value = Math.ceil(percent * 100) / 100;
    downloadSpeed.value = bytesPerSecond;
    willDownloadTotal.value = total;
  });

  window.electron.ipcRenderer.on('UPDATE_DOWNLOADED', () => {
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
    class="modal-wrapper"
    title="版本更新"
    cancelText="取消更新"
    centered
    :maskClosable="false"
    :closable="false"
    @ok="handleOkClick"
    :okText="!isDownloadEnd ? '下载更新' : '立即更新'"
    :footer="isDownloading ? null : undefined"
  >
    <div class="update-info" v-if="!isDownloading">当前最新版本：{{ newVersion }}</div>
    <div class="progress-wrapper" v-else>
      <Progress
        :percent="downloadProgress"
        :status="downloadProgress >= 100 ? 'success' : 'active'"
      />
      <div class="download-status">
        <span style="margin-right: 10px" v-if="!isDownloadEnd">
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

<style lang="scss" scoped>
.modal-wrapper {
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
