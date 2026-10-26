<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <h1 class="text-2xl font-bold text-text">Analisis Sampah</h1>
      <Button 
        variant="primary" 
        :disabled="!selectedCameraId || !hasApiKey" 
        @click="openCreateModal"
      >
        <Brain class="w-4 h-4" aria-hidden="true" />
        Jalankan Prediksi Baru
      </Button>
    </div>

    <div v-if="!hasApiKey" class="card border-warning-border bg-warning-bg/50">
      <div class="flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div class="flex-1">
          <p class="font-medium text-text">API Key belum diatur</p>
          <p class="text-sm text-text-muted mt-1">
            Atur akses API sebelum menjalankan prediksi.
            <RouterLink to="/dashboard/settings" class="text-brand underline ml-1">Buka Pengaturan</RouterLink>
          </p>
        </div>
      </div>
    </div>

    <!-- Camera Selector -->
    <div v-else class="card">
      <Label for="prediction-camera" class="label">Pilih Kamera</Label>
      <select
        id="prediction-camera"
        v-model="selectedCameraId"
        @change="onCameraChange"
        :disabled="!hasApiKey || cameraLoading || !cameras.length"
        class="input w-full md:w-64"
        aria-describedby="prediction-camera-help"
      >
        <option value="" disabled>Pilih kamera</option>
        <option v-for="cam in cameras" :key="cam.id" :value="cam.id">
          {{ cam.name }} ({{ cam.resolution_w }}×{{ cam.resolution_h }})
        </option>
      </select>
      <p id="prediction-camera-help" class="text-sm text-text-muted mt-1" v-if="selectedCameraId">
        Menampilkan prediksi untuk {{ selectedCamera?.name }}
      </p>
      <div v-if="cameraLoading" class="loading-state mt-2" role="status">
        <div class="spinner" aria-hidden="true" />
        Memuat data kamera...
      </div>
      <p v-else-if="hasApiKey && !cameras.length" class="text-sm text-text-muted mt-2">
        Belum ada kamera terdaftar.
        <RouterLink to="/dashboard/cameras" class="text-brand underline ml-1">Buka Manajemen Kamera</RouterLink>
      </p>
    </div>

    <div v-if="trackedJobId" class="card space-y-2" role="status">
      <p class="font-medium text-text">Job diterima backend</p>
      <p class="break-all text-sm text-text-muted">{{ trackedJobId }}</p>
      <p class="text-sm text-text-muted">Status dan hasil mengikuti job tersimpan. Menutup halaman tidak membatalkan pemrosesan.</p>
      <Button type="button" variant="outline" class="min-h-11" @click="viewJobDetails(trackedJobId)">Lihat Job Terkirim</Button>
    </div>

    <PredictionPollingNotice v-for="state in pollingErrors" :key="`${state.cameraId}:${state.jobId}`"
      :state="state" @retry="retryPolling(state.cameraId, state.jobId)" />

    <!-- Prerequisites Panel -->
    <div v-if="selectedCameraId" class="card">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-text">Prasyarat prediksi</h2>
          <p class="mt-1 text-sm text-text-muted">
            Prediksi memerlukan kalibrasi aktif, model ground aktif, dan depth scale aktif.
          </p>
        </div>
        <div v-if="checkingPrerequisites" class="flex shrink-0 items-center gap-2 text-sm text-text-muted" role="status">
          <div class="spinner" aria-hidden="true" />
          Memeriksa...
        </div>
      </div>

      <div v-if="prerequisitesError" class="mt-4 rounded-lg border border-negative-border bg-negative-bg/40 p-3" role="alert">
        <p class="text-sm text-negative">Gagal memeriksa prasyarat: {{ prerequisitesError }}</p>
        <Button type="button" variant="outline" class="mt-2" @click="checkPrerequisites">Coba Lagi</Button>
        <RouterLink to="/dashboard/settings" class="ml-3 inline-flex min-h-11 items-center text-sm text-brand underline">Buka Pengaturan</RouterLink>
      </div>

      <div v-else-if="!prerequisites" class="loading-state mt-4" role="status">
        <div class="spinner" aria-hidden="true" />
        Memeriksa prasyarat...
      </div>

      <div v-else class="mt-4 grid gap-3 sm:grid-cols-3">
        <div class="rounded-lg border border-sheet-border bg-sheet p-4">
          <div class="flex items-center gap-2">
            <CheckCircle v-if="prerequisites.has_active_calibration" class="h-5 w-5 shrink-0 text-positive" aria-hidden="true" />
            <XCircle v-else class="h-5 w-5 shrink-0 text-negative" aria-hidden="true" />
            <p class="font-medium text-text">Kalibrasi aktif</p>
          </div>
          <p class="mt-2 text-sm text-text-muted">
            {{ prerequisites.has_active_calibration ? 'Kalibrasi aktif tersedia; persyaratan intrinsics mengikuti tipe sumber.' : 'Kalibrasi aktif belum tersedia atau tidak sesuai kamera.' }}
          </p>
          <Badge :class="prerequisites.has_active_calibration ? 'badge-positive' : 'badge-negative'" class="mt-2">
            {{ prerequisites.has_active_calibration ? 'Tersedia' : 'Tidak tersedia' }}
          </Badge>
          <RouterLink
            :to="{ path: '/dashboard/calibrations', query: { camera: selectedCameraId } }"
            class="btn btn-ghost btn-sm mt-3 min-h-11 w-full justify-center"
          >
            Kelola kalibrasi
          </RouterLink>
        </div>

        <div class="rounded-lg border border-sheet-border bg-sheet p-4">
          <div class="flex items-center gap-2">
            <CheckCircle v-if="prerequisites.has_active_ground_model" class="h-5 w-5 shrink-0 text-positive" aria-hidden="true" />
            <XCircle v-else class="h-5 w-5 shrink-0 text-negative" aria-hidden="true" />
            <p class="font-medium text-text">Model ground aktif</p>
          </div>
          <p class="mt-2 text-sm text-text-muted">
            {{ prerequisites.has_active_ground_model ? 'Model cocok dengan kalibrasi dan referensi tanah aktif.' : 'Model ground belum tersedia atau tidak cocok dengan konfigurasi aktif.' }}
          </p>
          <Badge :class="prerequisites.has_active_ground_model ? 'badge-positive' : 'badge-negative'" class="mt-2">
            {{ prerequisites.has_active_ground_model ? 'Tersedia' : 'Tidak tersedia' }}
          </Badge>
          <RouterLink
            :to="{ path: '/dashboard/ground-references', query: { camera: selectedCameraId } }"
            class="btn btn-ghost btn-sm mt-3 min-h-11 w-full justify-center"
          >
            Kelola referensi tanah
          </RouterLink>
        </div>

        <div class="rounded-lg border border-sheet-border bg-sheet p-4">
          <div class="flex items-center gap-2">
            <CheckCircle v-if="prerequisites.has_active_depth_scale" class="h-5 w-5 shrink-0 text-positive" aria-hidden="true" />
            <XCircle v-else class="h-5 w-5 shrink-0 text-negative" aria-hidden="true" />
            <p class="font-medium text-text">Skala kedalaman aktif</p>
          </div>
          <p class="mt-2 text-sm text-text-muted">
            {{ prerequisites.has_active_depth_scale ? 'Skala aktif tersedia untuk model ground ini.' : 'Skala aktif belum dapat digunakan. Selesaikan prasyarat yang tercantum.' }}
          </p>
          <Badge :class="prerequisites.has_active_depth_scale ? 'badge-positive' : 'badge-negative'" class="mt-2">
            {{ prerequisites.has_active_depth_scale ? 'Tersedia' : 'Tidak tersedia' }}
          </Badge>
          <RouterLink v-if="!prerequisites.has_active_depth_scale" :to="{ path: '/dashboard/depth-scales', query: { camera: selectedCameraId } }" class="btn btn-ghost btn-sm mt-3 min-h-11 w-full justify-center">
            Kelola Skala Kedalaman
          </RouterLink>
        </div>
      </div>

      <PredictionReadinessIssues v-if="prerequisites" :readiness="prerequisites" class="mt-4" />
    </div>

    <!-- Prediction Jobs List -->
    <div v-if="selectedCameraId" class="card overflow-hidden">
      <div class="flex flex-col gap-2 border-b border-sheet-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold text-text">Riwayat prediksi</h2>
          <p class="text-sm text-text-muted">
            {{ predictionJobs.length }} dari {{ jobsTotal }} job untuk {{ selectedCamera?.name }}.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="min-h-11 shrink-0"
          :disabled="loading"
          aria-label="Muat ulang riwayat prediksi"
          @click="fetchPredictionJobs(1)"
        >
          <RefreshCw class="h-4 w-4" aria-hidden="true" />
          Muat ulang
        </Button>
      </div>

      <div class="table-container">
        <table class="table" aria-label="Daftar job prediksi">
          <thead>
            <tr>
              <th scope="col">Job ID</th>
              <th scope="col" class="hidden sm:table-cell">Sumber</th>
              <th scope="col" class="hidden sm:table-cell">Model Segmen</th>
              <th scope="col">Status</th>
              <th scope="col" class="hidden sm:table-cell">Dibuat</th>
              <th scope="col" class="hidden sm:table-cell">Selesai</th>
              <th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && predictionJobs.length === 0">
              <td colspan="7">
                <div class="loading-state" role="status">
                  <div class="spinner" aria-hidden="true" />
                  Memuat job prediksi...
                </div>
              </td>
            </tr>
            <tr v-else-if="loadError">
              <td colspan="7">
                <div class="error-state" role="alert">
                  <AlertCircle class="h-5 w-5" aria-hidden="true" />
                  <p class="font-medium text-text">Gagal memuat job prediksi</p>
                  <p class="text-sm text-text-muted">{{ loadError }}</p>
                  <Button type="button" variant="outline" class="btn-sm mt-2" @click="fetchPredictionJobs(1)">Coba Lagi</Button>
                </div>
              </td>
            </tr>
            <template v-else>
              <tr v-for="job in predictionJobs" :key="job.id" class="hover:bg-frame">
                <td class="font-mono text-sm">{{ job.id.substring(0, 8) }}…</td>
                <td class="hidden sm:table-cell">
                  <Badge :class="getSourceTypeBadgeClass(job.source_type)">
                    {{ formatSourceType(job.source_type) }}
                  </Badge>
                </td>
                <td class="hidden text-text-muted sm:table-cell">{{ job.seg_model || 'default' }}</td>
                <td>
                  <Badge :class="getStatusBadgeClass(displayStatus(job))" class="flex items-center gap-1">
                    {{ formatStatus(displayStatus(job)) }}
                  </Badge>
                  <p v-if="displayStatus(job) === 'done' && !hasPredictionVolume(job)" class="mt-1 text-sm text-text-muted">Hasil parsial</p>
                </td>
                <td class="hidden text-text-muted sm:table-cell">{{ formatDate(job.created_at) }}</td>
                <td class="hidden text-text-muted sm:table-cell">{{ job.completed_at ? formatDate(job.completed_at) : '-' }}</td>
                <td>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="min-h-11"
                    @click="viewJobDetails(job.id)"
                  >
                    Detail
                  </Button>
                </td>
              </tr>
              <tr v-if="!predictionJobs.length">
                <td colspan="7" class="py-8 text-center text-text-muted">
                  Belum ada job prediksi untuk kamera ini.
                  <button type="button" class="font-medium text-brand underline" @click="openCreateModal">
                    Jalankan prediksi pertama
                  </button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="jobsPage < jobsTotalPages" class="border-t border-sheet-border p-3 text-center">
        <Button
          type="button"
          variant="outline"
          class="min-h-11"
          :disabled="loadingMoreJobs"
          @click="loadMoreJobs"
        >
          <span v-if="loadingMoreJobs" class="spinner" aria-hidden="true" />
          {{ loadingMoreJobs ? 'Memuat...' : 'Muat job berikutnya' }}
        </Button>
      </div>
    </div>

    <div v-else class="card empty-state py-12">
      <Video class="empty-state-icon" aria-hidden="true" />
      <p class="empty-state-title">Pilih kamera untuk memulai</p>
      <p class="empty-state-description">Pilih kamera dari dropdown di atas untuk melihat daftar job prediksi dan menjalankan analisis baru.</p>
    </div>

    <!-- Create Prediction Modal -->
    <Dialog
      v-model:open="isCreateModalOpen"
      :show-close-button="!submitting"
      :disabled="submitting"
      content-class="max-w-2xl"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Jalankan Prediksi Baru</DialogTitle>
          <DialogDescription class="break-words">Konfigurasi dan jalankan prediksi volume untuk {{ selectedCamera?.name }}.</DialogDescription>
        </DialogHeader>

        <!-- Prerequisites Status in Modal -->
        <div class="mb-4 rounded-lg border p-4" :class="prerequisitesValue ? prerequisitesModalClass : 'border-sheet-border bg-frame'">
          <h3 class="mb-3 text-sm font-medium text-text">Prasyarat prediksi</h3>
          <div v-if="checkingPrerequisites" class="loading-state" role="status">
            <div class="spinner" aria-hidden="true" />
            Memeriksa prasyarat...
          </div>
          <div v-else-if="prerequisitesError" role="alert">
            <p class="text-sm text-negative">Gagal memeriksa prasyarat: {{ prerequisitesError }}</p>
            <Button type="button" variant="outline" class="mt-2" @click="checkPrerequisites">Coba Lagi</Button>
            <RouterLink to="/dashboard/settings" class="ml-3 inline-flex min-h-11 items-center text-sm text-brand underline">Buka Pengaturan</RouterLink>
          </div>
          <div v-else-if="prerequisitesValue" class="space-y-2 text-sm">
            <div class="flex items-center gap-2">
              <span class="shrink-0" :class="prerequisitesValue.has_active_calibration ? 'text-positive' : 'text-negative'">
                <CheckCircle v-if="prerequisitesValue.has_active_calibration" class="h-4 w-4" aria-hidden="true" />
                <XCircle v-else class="h-4 w-4" aria-hidden="true" />
              </span>
              <span class="text-text">Kalibrasi aktif</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="shrink-0" :class="prerequisitesValue.has_active_ground_model ? 'text-positive' : 'text-negative'">
                <CheckCircle v-if="prerequisitesValue.has_active_ground_model" class="h-4 w-4" aria-hidden="true" />
                <XCircle v-else class="h-4 w-4" aria-hidden="true" />
              </span>
              <span class="text-text">Model ground aktif</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="shrink-0" :class="prerequisitesValue.has_active_depth_scale ? 'text-positive' : 'text-negative'">
                <CheckCircle v-if="prerequisitesValue.has_active_depth_scale" class="h-4 w-4" aria-hidden="true" />
                <XCircle v-else class="h-4 w-4" aria-hidden="true" />
              </span>
              <span class="text-text">Depth scale aktif</span>
            </div>
            <PredictionReadinessIssues :readiness="prerequisitesValue" />
          </div>
          <p v-else class="text-sm text-text-muted">Prasyarat belum diperiksa.</p>
        </div>

        <form @submit.prevent="submitPrediction" class="space-y-4">
          <div class="space-y-2">
            <Label for="pred-source-type">Tipe Sumber</Label>
            <select
              id="pred-source-type"
              v-model="predForm.source_type"
              :disabled="submitting"
              class="input"
              aria-describedby="source-type-help"
            >
              <option value="upload">Upload Gambar</option>
              <option value="rtsp_frame">Frame RTSP (tangkap saat eksekusi)</option>
              <option value="latest_rtsp">Frame Terbaru RTSP (snapshot tersimpan)</option>
            </select>
            <p id="source-type-help" class="text-xs text-text-muted">
              Upload: kirim file gambar. rtsp_frame: ambil frame baru saat job dieksekusi. latest_rtsp: pakai snapshot tersimpan terbaru (harus segar).
            </p>
          </div>

          <div v-if="predForm.source_type === 'upload'" class="space-y-2">
            <Label for="pred-image">Upload Gambar</Label>
<input 
  id="pred-image" 
  type="file" 
  accept="image/*" 
  @change="handleImageUpload" 
  :disabled="submitting"
  class="input"
  aria-describedby="pred-image-help"
/>
            <p v-if="uploadedImage" class="text-sm text-positive" role="status">
              Gambar terpilih: {{ uploadedImage.name }} ({{ formatBytes(uploadedImage.size) }})
            </p>
            <p id="pred-image-help" class="text-xs text-text-muted">Format gambar: JPEG, PNG. Maksimal 10 MB.</p>
          </div>

          <div v-if="predForm.source_type !== 'upload'" class="space-y-2">
            <Label for="pred-max-frame-age">Maksimal Usia Frame (detik)</Label>
            <Input 
              id="pred-max-frame-age" 
              v-model="predForm.max_frame_age_sec" 
              type="number" 
              min="1" 
              max="300" 
              :disabled="submitting"
              class="input"
              aria-describedby="max-frame-age-help"
            />
            <p id="max-frame-age-help" class="text-xs text-text-muted">
              Batas usia snapshot untuk latest_rtsp (dicek saat submit dan eksekusi). Default: 30 detik.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
            <div class="space-y-2">
              <Label for="pred-conf">Confidence Threshold</Label>
              <Input 
                id="pred-conf" 
                v-model="predForm.seg_conf" 
                type="number" 
                step="0.01" 
                min="0" 
                max="1" 
                :disabled="submitting"
                class="input"
              />
            </div>
            <div class="space-y-2">
              <Label for="pred-cell">Cell Size (meter)</Label>
              <Input 
                id="pred-cell" 
                v-model="predForm.volume_cell_m" 
                type="number" 
                step="0.01" 
                min="0.01" 
                max="1" 
                :disabled="submitting"
                class="input"
              />
            </div>
          </div>

          <div class="space-y-2">
            <Label for="pred-min-pts">Min Points per Cell</Label>
            <Input 
              id="pred-min-pts" 
              v-model="predForm.volume_min_pts_per_cell" 
              type="number" 
              min="1" 
              max="10000" 
              :disabled="submitting"
              class="input"
            />
          </div>

          <div class="space-y-2">
            <Label>Output yang Dikembalikan</Label>
            <p class="text-xs text-text-muted">Pilih artefak output yang dihasilkan backend (sesuai OpenAPI contract)</p>
            <div class="flex flex-wrap gap-3">
              <label v-for="output in availableOutputs" :key="output.value" class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  :value="output.value" 
                  v-model="predForm.return_outputs" 
                  class="h-4 w-4 rounded border-control text-brand focus:ring-brand"
                  :disabled="submitting"
                />
                <span class="text-sm text-text">{{ output.label }}</span>
              </label>
            </div>
          </div>

          <div v-if="submitError" class="error-state" role="alert">
            <AlertCircle class="w-5 h-5" aria-hidden="true" />
            <p class="font-medium text-text">{{ submitUncertain ? 'Status pengiriman belum diketahui' : 'Gagal menjalankan prediksi' }}</p>
            <p class="text-sm text-text-muted">{{ submitError }}</p>
            <Button v-if="submitUncertain" type="button" variant="outline" class="min-h-11" @click="isCreateModalOpen = false; fetchPredictionJobs(1)">Periksa Riwayat</Button>
          </div>

          <p v-if="!canSubmit && !submitting" id="prediction-submit-help" class="text-sm text-text-muted" role="status">
            {{ submitBlockedReason }}
            <RouterLink v-if="prerequisites?.ready && predForm.source_type !== 'upload' && submitBlockedReason && !checkingPrerequisites" :to="{ path: '/dashboard/cameras', query: { camera: selectedCameraId } }" class="inline-flex min-h-11 items-center text-brand underline">Buka Manajemen Kamera</RouterLink>
          </p>
          <DialogFooter>
            <Button type="button" variant="secondary" :disabled="submitting" @click="isCreateModalOpen = false">Batal</Button>
            <Button type="submit" :disabled="submitting || !canSubmit" :aria-busy="submitting" :aria-describedby="!canSubmit ? 'prediction-submit-help' : undefined" variant="primary">
              {{ submitting ? 'Memproses...' : 'Jalankan Prediksi' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Job Detail Dialog -->
    <Dialog
      v-model:open="isJobDetailOpen"
      content-class="max-w-5xl"
      @update:open="onJobDetailOpenChange"
    >
      <DialogHeader>
        <DialogTitle class="mb-0">Detail Job Prediksi</DialogTitle>
      </DialogHeader>

      <DialogContent class="text-sm">
      <DialogDescription v-if="selectedJob" class="mb-4">Job {{ selectedJob.id.substring(0, 8) }}… · {{ formatSourceType(selectedJob.source_type) }} · {{ formatStatus(selectedJob.status) }}</DialogDescription>
      <div v-if="loadingJobDetail" class="loading-state" role="status" style="height: 300px;">
        <div class="spinner" aria-hidden="true" />
        Memuat detail job...
      </div>

      <div v-else-if="jobDetailError" class="space-y-3" role="alert">
        <p class="text-negative">Gagal memuat detail job. {{ jobDetailError }}</p>
        <Button type="button" variant="outline" class="min-h-11 text-sm" @click="loadJobDetail(requestedJobId)">Muat Ulang Detail</Button>
      </div>

      <template v-else-if="selectedJob">
        <PredictionPollingNotice v-if="selectedPollingState?.error" :state="selectedPollingState" class="mb-4"
          @retry="retryPolling(selectedJob.camera_id, selectedJob.id)" />
        <div class="mb-4 space-y-2 text-sm" role="status">
          <p v-if="isUnfinishedJob(selectedJob.status)" class="text-text-muted">{{ selectedJob.status === 'pending' ? 'Job menunggu worker.' : 'Worker sedang memproses job.' }} Status diperiksa otomatis. Menutup detail tidak membatalkan job.</p>
          <p v-else-if="selectedJob.status === 'failed'" class="text-negative">{{ predictionFailureMessage(selectedJob) }}</p>
          <p v-else-if="selectedJob.status === 'done' && !hasPredictionVolume(selectedJob)" class="text-warning">Job selesai, tetapi hasil volume belum lengkap. Muat ulang detail; bila tetap tidak tersedia, periksa job bersama operator.</p>
          <p v-else-if="selectedJob.status === 'done'" class="text-text-muted">Job selesai. Tinjau rincian volume dan metode di bawah.</p>
          <Button type="button" variant="outline" class="min-h-11 text-sm" @click="loadJobDetail(selectedJob.id)">Muat Ulang Detail</Button>
        </div>
        <div v-if="jobDetailWarnings.length > 0" class="mb-4 rounded-lg border border-warning-border bg-warning-bg/50 p-3" role="status">
          <p class="text-sm font-medium text-warning">Sebagian detail tidak dapat dimuat</p>
          <ul class="mt-1 list-inside list-disc text-sm text-text-muted">
            <li v-for="warning in jobDetailWarnings" :key="warning">{{ warning }}</li>
          </ul>
        </div>

        <PredictionResultSummary v-if="selectedJob.status === 'done' || jobVolumes.length > 0" :volumes="jobVolumes" />

        <div class="mb-6 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <p class="text-sm text-text-muted">Job ID</p>
            <p class="break-all font-mono text-sm text-text">{{ selectedJob.id }}</p>
          </div>
          <div>
            <p class="text-sm text-text-muted">Status</p>
            <Badge :class="getStatusBadgeClass(selectedJob.status)">{{ formatStatus(selectedJob.status) }}</Badge>
          </div>
          <div>
            <p class="text-sm text-text-muted">Sumber</p>
            <p class="text-text">{{ formatSourceType(selectedJob.source_type) }}</p>
          </div>
          <div>
            <p class="text-sm text-text-muted">Kamera ID</p>
            <p class="break-all font-mono text-sm text-text">{{ selectedJob.camera_id }}</p>
          </div>
          <div>
            <p class="text-sm text-text-muted">Dibuat</p>
            <p class="text-text">{{ formatDate(selectedJob.created_at) }}</p>
          </div>
          <div v-if="selectedJob.completed_at">
            <p class="text-sm text-text-muted">Selesai</p>
            <p class="text-text">{{ formatDate(selectedJob.completed_at) }}</p>
          </div>
          <div class="sm:col-span-2">
            <p class="text-sm text-text-muted">{{ selectedJob.source_type === 'upload' ? 'Waktu sumber dari pengunggah' : 'Waktu penerimaan frame oleh worker' }}</p>
            <p class="text-sm text-text">{{ formatSourceTimestamp(selectedJob.source_ts) }}</p>
            <p v-if="selectedJob.source_type !== 'upload'" class="mt-1 text-xs text-text-muted">Waktu penerimaan UTC, bukan waktu sensor kamera.</p>
          </div>
          <div class="sm:col-span-2 md:col-span-4">
            <p class="text-sm text-text-muted">Key sumber tersimpan</p>
            <p class="break-all text-sm text-text">{{ selectedJob.source_path || 'Tidak tersedia' }}</p>
            <p v-if="selectedJob.source_path" class="mt-1 text-xs text-text-muted">Identitas penyimpanan privat dari job, bukan URL gambar.</p>
          </div>
        </div>

        <details class="mb-6 rounded-md border border-sheet-border p-4">
          <summary class="min-h-11 cursor-pointer content-center text-sm font-medium text-text">Konfigurasi job tersimpan</summary>
          <p class="mt-2 text-sm text-text-muted">ID dan parameter dari job ini. Konfigurasi aktif kamera saat ini dapat berbeda.</p>
          <dl class="mt-4 grid min-w-0 grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div><dt class="text-text-muted">Kalibrasi ID</dt><dd class="break-all font-mono">{{ selectedJob.calibration_id || 'Tidak tersedia' }}</dd></div>
            <div><dt class="text-text-muted">Model ground ID</dt><dd class="break-all font-mono">{{ selectedJob.ground_model_id || 'Tidak tersedia' }}</dd></div>
            <div><dt class="text-text-muted">Skala kedalaman ID</dt><dd class="break-all font-mono">{{ selectedJob.depth_scale_id || 'Tidak tersedia' }}</dd></div>
            <div><dt class="text-text-muted">Model segmentasi</dt><dd class="break-all">{{ selectedJob.seg_model || 'Tidak dilaporkan' }}</dd></div>
            <div><dt class="text-text-muted">Ambang confidence segmentasi</dt><dd class="tabular-nums">{{ formatConfidence(selectedJob.seg_conf) }}</dd></div>
            <div><dt class="text-text-muted">Ukuran sel permintaan (m)</dt><dd class="tabular-nums">{{ formatMeasurement(selectedJob.volume_cell_m) }}</dd></div>
            <div><dt class="text-text-muted">Minimum titik per sel</dt><dd class="tabular-nums">{{ formatMeasurement(selectedJob.volume_min_pts_per_cell, 0) }}</dd></div>
            <div v-if="selectedJob.source_type !== 'upload'"><dt class="text-text-muted">Batas usia frame (detik)</dt><dd class="tabular-nums">{{ formatMeasurement(selectedJob.max_frame_age_sec, 0) }}</dd></div>
          </dl>
          <p class="mt-3 text-xs text-text-muted">Confidence segmentasi adalah ambang deteksi, bukan tingkat akurasi volume.</p>
        </details>

        <!-- Image Gallery -->
        <div v-if="jobOutputs.length > 0" class="border-t border-sheet-border pt-6 mb-6">
          <h3 class="text-sm font-medium text-text mb-4">Output Gambar</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div v-for="output in jobOutputs" :key="output.id" class="space-y-2">
              <AuthenticatedArtifact :path="getOutputPath(selectedJob.camera_id, selectedJob.id, output.output_type)" :label="formatOutputType(output.output_type)" />
              <div class="text-center">
                <p class="text-xs font-medium text-text truncate">{{ formatOutputType(output.output_type) }}</p>
                <p class="text-xs text-text-muted">{{ output.width }}×{{ output.height }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Instance Table -->
        <div v-if="jobInstances.length > 0" class="border-t border-sheet-border pt-6 mb-6">
          <h3 class="text-sm font-medium text-text mb-4">Instance Terdeteksi</h3>
          <div class="table-container">
            <table class="table" aria-label="Instance terdeteksi">
              <thead>
                <tr>
                  <th scope="col">Kelas</th>
                  <th scope="col" class="numeric">Confidence</th>
                  <th scope="col" class="numeric">Volume (m³)</th>
                  <th scope="col" class="numeric">Footprint (m²)</th>
                  <th scope="col" class="numeric">Tinggi Rata (m)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="inst in jobInstances" :key="inst.id">
                  <td class="font-medium text-text">{{ inst.cls_name }}</td>
                  <td class="numeric tabular-nums">{{ formatConfidence(inst.confidence) }}</td>
                  <td class="numeric tabular-nums">{{ formatMeasurement(inst.volume_m3) }}</td>
                  <td class="numeric tabular-nums">{{ formatMeasurement(inst.footprint_m2) }}</td>
                  <td class="numeric tabular-nums">{{ formatMeasurement(inst.height_mean_m) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="jobOutputs.length === 0 && jobInstances.length === 0 && jobVolumes.length === 0 && jobDetailWarnings.length === 0" class="empty-state border-t border-sheet-border py-8">
          <Brain class="empty-state-icon" aria-hidden="true" />
          <p class="empty-state-title">Belum ada output untuk job ini</p>
          <p class="empty-state-description">{{ isUnfinishedJob(selectedJob.status) ? 'Output akan tersedia setelah pemrosesan selesai.' : 'Backend belum mengembalikan output untuk job ini. Periksa status dan hasil di atas.' }}</p>
        </div>
      </template>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useApiStore } from '@/stores/api'
import { useConnectionScope } from '@/composables/useConnectionScope'
import { useJobPolling } from '@/composables/useJobPolling'
import { listCameras as apiListCameras } from '@/services/cameras'
import { 
  listPredictionJobs as apiListPredictionJobs, 
  getPredictionJob as apiGetPredictionJob, 
  submitPrediction as apiSubmitPrediction, 
  listPredictionOutputs as apiListPredictionOutputs, 
  getPredictionInstances as apiGetPredictionInstances, 
  getPredictionVolumes as apiGetPredictionVolumes, 
  getOutputPath,
  type SubmitPredictionPayload,
} from '@/services/predictions'
import { checkReadiness, getMissingPrerequisiteLabels } from '@/services/readiness'
import { getLatestSnapshot, isSnapshotFresh } from '@/services/snapshots'
import { normalizeApiError } from '@/services/api'
import type { Camera, PredictionJob, PredictionOutput, DetectedInstance, VolumeEstimate, PredictionPrerequisites } from '@/types'

// UI Components
import { Button, Input, Label, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui'
import AuthenticatedArtifact from '@/components/AuthenticatedArtifact.vue'
import PredictionReadinessIssues from '@/components/PredictionReadinessIssues.vue'
import PredictionPollingNotice from '@/components/PredictionPollingNotice.vue'
import { hasPredictionVolume, isUnfinishedJob, predictionFailureMessage } from '@/lib/prediction-job'
import { formatMeasurement, formatConfidence, formatSourceTimestamp } from '@/lib/measurement-format'
import PredictionResultSummary from '@/components/PredictionResultSummary.vue'

import { Brain, Video, AlertCircle, CheckCircle, XCircle, HelpCircle, RefreshCw } from '@lucide/vue'

const route = useRoute()
const router = useRouter()
const apiStore = useApiStore()
const toast = useToast()
const isActive = useConnectionScope()

const cameras = ref<Camera[]>([])
const predictionJobs = ref<PredictionJob[]>([])
const selectedCameraId = ref('')
const loading = ref(false)
const loadingMoreJobs = ref(false)
const loadError = ref('')
const cameraLoading = ref(false)
const submitting = ref(false)
const submitError = ref('')
const submitUncertain = ref(false)
const selectedJob = ref<PredictionJob | null>(null)
const isCreateModalOpen = ref(false)
const isJobDetailOpen = ref(false)
const jobsPage = ref(1)
const jobsTotal = ref(0)
const jobsTotalPages = ref(1)

const jobOutputs = ref<PredictionOutput[]>([])
const jobInstances = ref<DetectedInstance[]>([])
const jobVolumes = ref<VolumeEstimate[]>([])
const jobDetailWarnings = ref<string[]>([])
const loadingJobDetail = ref(false)
const jobDetailError = ref('')
const requestedJobId = ref('')
let jobListRequestId = 0
let jobDetailRequestId = 0

const uploadedImage = ref<File | null>(null)
const prerequisites = ref<PredictionPrerequisites | null>(null)
const checkingPrerequisites = ref(false)
const prerequisitesError = ref('')

const predForm = ref({
  source_type: 'upload' as 'upload' | 'rtsp_frame' | 'latest_rtsp',
  seg_conf: 0.25,
  volume_cell_m: 0.05,
  volume_min_pts_per_cell: 2,
  max_frame_age_sec: 30,
  return_outputs: [] as string[],
})

// Available outputs from OpenAPI contract
const availableOutputs = [
  { value: 'mask', label: 'Mask' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'instances_json', label: 'Instances JSON' },
  { value: 'depth_raw_vis', label: 'Depth Raw Vis' },
  { value: 'depth_scaled_vis', label: 'Depth Scaled Vis' },
  { value: 'depth_masked', label: 'Depth Masked' },
  { value: 'height_map', label: 'Height Map' },
  { value: 'lifted_points_npz', label: 'Lifted Points NPZ' },
  { value: 'volume_heatmap', label: 'Volume Heatmap' },
  { value: 'volume_result_npz', label: 'Volume Result NPZ' },
  { value: 'bev_image', label: 'BEV Image' },
  { value: 'bev_mask_proyeksi', label: 'BEV Mask Proyeksi' },
  { value: 'bev_overlay', label: 'BEV Overlay' },
]

const notifiedJobs = new Set<string>()
const jobToastIds = new Set<string | number>()
function dismissJobNotifications() {
  for (const id of jobToastIds) toast.dismiss(id)
  jobToastIds.clear()
}
onScopeDispose(dismissJobNotifications)

const { pollingJobs, startPolling, retryPolling, getPollingStatus, stopPolling, reconcileJob } = useJobPolling(
  apiGetPredictionJob,
  (updatedJob) => {
    if (!isActive() || updatedJob.camera_id !== selectedCameraId.value) return
    predictionJobs.value = predictionJobs.value.map(job => job.id === updatedJob.id ? updatedJob : job)
    if (selectedJob.value?.id === updatedJob.id) selectedJob.value = updatedJob
    if (isUnfinishedJob(updatedJob.status)) return
    if (notifiedJobs.has(updatedJob.id)) return
    notifiedJobs.add(updatedJob.id)
    if (isJobDetailOpen.value && requestedJobId.value === updatedJob.id) {
      void loadJobDetail(updatedJob.id, false)
    }
    if (isJobDetailOpen.value || isCreateModalOpen.value) return
    if (updatedJob.status === 'failed') {
      jobToastIds.add(toast.error('Prediksi gagal', { description: predictionFailureMessage(updatedJob) }))
    } else if (hasPredictionVolume(updatedJob)) {
      jobToastIds.add(toast.success('Prediksi selesai', { description: `Job ${updatedJob.id.substring(0, 8)}… memiliki hasil volume.` }))
    } else {
      jobToastIds.add(toast.warning('Hasil prediksi belum lengkap', { description: 'Job selesai tanpa hasil volume lengkap. Buka detail dan muat ulang hasil.' }))
    }
  },
)

const trackedJobId = computed(() => typeof route.query.tracking === 'string' ? route.query.tracking : '')
const pollingErrors = computed(() => [...pollingJobs.value.values()].filter(state => state.cameraId === selectedCameraId.value && state.error))
const selectedPollingState = computed(() => selectedJob.value ? getPollingStatus(selectedJob.value.camera_id, selectedJob.value.id) : undefined)
const hasApiKey = computed(() => apiStore.hasApiKey)
const selectedCamera = computed(() => cameras.value.find(c => c.id === selectedCameraId.value))

const prerequisitesValue = computed(() => prerequisites.value)

const prerequisitesModalClass = computed(() => {
  if (!prerequisites.value) return ''
  if (prerequisites.value.ready) {
    return 'border-positive-border bg-positive-bg/30'
  }
  return 'border-warning-border bg-warning-bg/30'
})

const submitBlockedReason = computed(() => {
  if (submitUncertain.value) return 'Periksa riwayat untuk memastikan apakah job tersimpan sebelum membuat prediksi baru.'
  if (!selectedCameraId.value || !hasApiKey.value) return 'Pilih kamera dan atur akses API terlebih dahulu.'
  if (checkingPrerequisites.value) return 'Tunggu pemeriksaan prasyarat selesai.'
  if (prerequisitesError.value) return 'Prasyarat belum dapat diverifikasi. Coba lagi atau periksa akses API di Pengaturan.'
  const pre = prerequisites.value
  if (!pre || pre.camera_id !== selectedCameraId.value || pre.source_type !== predForm.value.source_type) return 'Periksa prasyarat untuk kamera dan sumber ini.'
  if (!pre.ready) return 'Selesaikan konfigurasi yang tercantum pada prasyarat prediksi.'
  if (predForm.value.source_type === 'upload') return uploadedImage.value ? '' : 'Pilih gambar untuk diunggah.'
  if (!selectedCamera.value?.rtsp_configured) return 'Atur sumber RTSP di Manajemen Kamera terlebih dahulu.'
  if (!selectedCamera.value.stream_enabled) return 'Aktifkan stream di Manajemen Kamera terlebih dahulu.'
  return ''
})
const canSubmit = computed(() => !submitting.value && !submitBlockedReason.value)

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
    return error.message
  return 'Permintaan gagal. Coba kembali.'
}

async function loadAllCameras(): Promise<Camera[]> {
  const first = await apiListCameras(1, 100)
  const items = [...first.items]
  for (let page = 2; page <= first.total_pages; page += 1) {
    const next = await apiListCameras(page, 100)
    items.push(...next.items)
  }
  return items
}

async function fetchCameras() {
  if (!hasApiKey.value) return
  cameraLoading.value = true
  try {
    const items = await loadAllCameras()
    if (!isActive()) return
    cameras.value = items

    const queryCamera = typeof route.query.camera === 'string' ? route.query.camera : ''
    const current = items.find(camera => camera.id === selectedCameraId.value)
    const fromQuery = items.find(camera => camera.id === queryCamera)
    if (!current) {
      selectedCameraId.value = fromQuery?.id ?? items[0]?.id ?? ''
    }
  } catch (error) {
    if (!isActive()) return
    toast.error('Gagal memuat data kamera', { description: errorMessage(error) })
  } finally {
    cameraLoading.value = false
  }
}

async function fetchPredictionJobs(page = 1, append = false) {
  if (!selectedCameraId.value || !hasApiKey.value) return
  const cameraId = selectedCameraId.value
  const requestId = ++jobListRequestId
  const before = new Map([...pollingJobs.value].map(([key, state]) => [key, state.job]))

  if (append) {
    loadingMoreJobs.value = true
  } else {
    loading.value = true
    loadError.value = ''
  }

  try {
    const response = await apiListPredictionJobs(cameraId, page)
    if (!isActive() || cameraId !== selectedCameraId.value || requestId !== jobListRequestId) return

    const incoming = response.items.map(job => {
      const current = getPollingStatus(cameraId, job.id)?.job
      return current && current !== before.get(`${cameraId}:${job.id}`) ? current : reconcileJob(job)
    })
    const items = append ? [...predictionJobs.value, ...incoming] : incoming
    predictionJobs.value = [...new Map(items.map(job => [job.id, job])).values()]
    jobsPage.value = response.page
    jobsTotal.value = response.total
    jobsTotalPages.value = response.total_pages

    for (const job of predictionJobs.value) {
      if (job.status === 'pending' || job.status === 'processing') {
        startPolling(cameraId, job.id, job.status)
      }
    }
  } catch (error) {
    if (!isActive() || cameraId !== selectedCameraId.value || requestId !== jobListRequestId) return
    if (append) {
      toast.error('Gagal memuat job berikutnya', { description: errorMessage(error) })
    } else {
      loadError.value = errorMessage(error)
      toast.error('Gagal memuat data prediksi')
    }
  } finally {
    if (isActive() && cameraId === selectedCameraId.value && requestId === jobListRequestId) {
      loading.value = false
      loadingMoreJobs.value = false
    }
  }
}

async function loadMoreJobs() {
  await fetchPredictionJobs(jobsPage.value + 1, true)
}

function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement | null
  uploadedImage.value = target?.files?.[0] ?? null
}

async function onCameraChange() {
  stopPolling()
  jobsPage.value = 1
  jobsTotal.value = 0
  jobsTotalPages.value = 1
  predictionJobs.value = []
  selectedJob.value = null
  jobOutputs.value = []
  jobInstances.value = []
  jobVolumes.value = []
  jobDetailWarnings.value = []
  isJobDetailOpen.value = false

  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (key !== 'job' && key !== 'tracking' && typeof value === 'string') query[key] = value
  }
  if (selectedCameraId.value) query.camera = selectedCameraId.value
  await router.replace({ query })

  await Promise.all([fetchPredictionJobs(1), checkPrerequisites()])
}

let prerequisiteRequestId = 0

async function checkPrerequisites() {
  const requestId = ++prerequisiteRequestId
  prerequisites.value = null
  prerequisitesError.value = ''
  if (!selectedCameraId.value) {
    checkingPrerequisites.value = false
    return
  }

  const cameraId = selectedCameraId.value
  const sourceType = predForm.value.source_type
  checkingPrerequisites.value = true

  try {
    const result = await checkReadiness(cameraId, sourceType)
    if (!isActive() || requestId !== prerequisiteRequestId || cameraId !== selectedCameraId.value || sourceType !== predForm.value.source_type) return
    prerequisites.value = result
    return result
  } catch (error) {
    if (!isActive() || requestId !== prerequisiteRequestId || cameraId !== selectedCameraId.value) return
    prerequisites.value = null
    prerequisitesError.value = errorMessage(error)
  } finally {
    if (requestId === prerequisiteRequestId) {
      checkingPrerequisites.value = false
    }
  }
}

watch(selectedCameraId, () => {
  stopPolling()
  dismissJobNotifications()
  notifiedJobs.clear()
  jobListRequestId += 1
  jobDetailRequestId += 1
  loadingJobDetail.value = false
  jobDetailError.value = ''
  isJobDetailOpen.value = false
  requestedJobId.value = ''
  selectedJob.value = null
  predictionJobs.value = []
  prerequisiteRequestId += 1
  prerequisites.value = null
  prerequisitesError.value = ''
  checkingPrerequisites.value = false
}, { flush: 'sync' })

watch(() => predForm.value.source_type, () => {
  void checkPrerequisites()
}, { flush: 'sync' })

const openCreateModal = async () => {
  if (!selectedCameraId.value) return
  dismissJobNotifications()
  predForm.value = {
    source_type: 'upload',
    seg_conf: 0.25,
    volume_cell_m: 0.05,
    volume_min_pts_per_cell: 2,
    max_frame_age_sec: 30,
    return_outputs: ['mask', 'overlay', 'bev_image', 'bev_overlay', 'instances_json'],
  }
  uploadedImage.value = null
  submitError.value = ''
  submitUncertain.value = false
  isCreateModalOpen.value = true
  await checkPrerequisites()
}

async function submitPrediction() {
  if (!selectedCameraId.value || submitting.value) return
  if (!canSubmit.value) {
    submitError.value = submitBlockedReason.value
    return
  }

  const cameraId = selectedCameraId.value
  const sourceType = predForm.value.source_type
  const segConf = Number(predForm.value.seg_conf)
  const cellSize = Number(predForm.value.volume_cell_m)
  const minPoints = Number(predForm.value.volume_min_pts_per_cell)
  const maxFrameAge = Number(predForm.value.max_frame_age_sec)
  if (!Number.isFinite(segConf) || !Number.isFinite(cellSize) || !Number.isFinite(minPoints) || !Number.isFinite(maxFrameAge)) {
    submitError.value = 'Isi confidence, cell size, minimal titik per sel, dan maksimal usia frame dengan angka yang valid.'
    return
  }

  const payload: SubmitPredictionPayload = {
    source_type: sourceType,
    seg_conf: segConf,
    volume_cell_m: cellSize,
    volume_min_pts_per_cell: minPoints,
    max_frame_age_sec: maxFrameAge,
    return_outputs: [...predForm.value.return_outputs],
  }

  if (sourceType === 'upload' && uploadedImage.value) {
    payload.file = uploadedImage.value
    payload.timestamp = new Date().toISOString()
  }

  submitting.value = true
  submitError.value = ''
  let sent = false
  try {
    const pre = await checkPrerequisites()
    if (!isActive() || cameraId !== selectedCameraId.value || sourceType !== predForm.value.source_type) return
    if (!pre?.ready) {
      submitError.value = pre ? getMissingPrerequisiteLabels(pre.missing).join(' ') : prerequisitesError.value || 'Prasyarat belum dapat diverifikasi. Periksa kembali sebelum mengirim prediksi.'
      return
    }

    if (sourceType === 'latest_rtsp') {
      const snapshot = await getLatestSnapshot(cameraId, { max_frame_age_sec: maxFrameAge })
      if (!isSnapshotFresh(snapshot, maxFrameAge)) {
        submitError.value = 'Snapshot terakhir terlalu lama. Ambil snapshot baru atau gunakan rtsp_frame.'
        return
      }
    }
    if (!isActive() || cameraId !== selectedCameraId.value || sourceType !== predForm.value.source_type) return

    sent = true
    const result = await apiSubmitPrediction(cameraId, payload)
    sent = false
    if (!isActive() || cameraId !== selectedCameraId.value) return

    jobToastIds.add(toast.info('Prediksi berhasil dikirim', {
      description: `Job ID: ${result.job_id}`,
    }))
    isCreateModalOpen.value = false
    uploadedImage.value = null
    startPolling(cameraId, result.job_id, result.status)
    await router.replace({ query: { ...route.query, camera: cameraId, tracking: result.job_id } })
    if (!isActive() || cameraId !== selectedCameraId.value) return
    await fetchPredictionJobs(1)
  } catch (error: unknown) {
    if (!isActive() || cameraId !== selectedCameraId.value) return
    const err = normalizeApiError(error)
    submitUncertain.value = sent && (err.status === null || err.status >= 500)
    submitError.value = submitUncertain.value
      ? 'Konfirmasi backend tidak diterima. Job mungkin sudah tersimpan. Periksa riwayat sebelum mengirim ulang; permintaan tidak diulang otomatis.'
      : err.message
  } finally {
    submitting.value = false
  }
}

async function loadJobDetail(jobId: string, showLoading = true) {
  const cameraId = selectedCameraId.value
  if (!cameraId) return
  const requestId = ++jobDetailRequestId
  const before = getPollingStatus(cameraId, jobId)?.job
  requestedJobId.value = jobId
  jobDetailError.value = ''

  if (showLoading) {
    dismissJobNotifications()
    loadingJobDetail.value = true
    isJobDetailOpen.value = true
    selectedJob.value = null
    jobOutputs.value = []
    jobInstances.value = []
    jobVolumes.value = []
  }
  jobDetailWarnings.value = []

  try {
    const [jobResult, outputsResult, instancesResult, volumesResult] = await Promise.allSettled([
      apiGetPredictionJob(cameraId, jobId),
      apiListPredictionOutputs(cameraId, jobId),
      apiGetPredictionInstances(cameraId, jobId),
      apiGetPredictionVolumes(cameraId, jobId),
    ])
    if (!isActive() || cameraId !== selectedCameraId.value || requestId !== jobDetailRequestId || !isJobDetailOpen.value) return

    if (jobResult.status === 'rejected') {
      jobDetailError.value = errorMessage(jobResult.reason)
      return
    }

    const current = getPollingStatus(cameraId, jobId)?.job
    selectedJob.value = current && current !== before ? current : reconcileJob(jobResult.value)
    predictionJobs.value = predictionJobs.value.map(job => job.id === jobId ? selectedJob.value! : job)

    if (outputsResult.status === 'fulfilled') {
      jobOutputs.value = outputsResult.value
    } else {
      jobOutputs.value = []
      jobDetailWarnings.value.push('Output gambar tidak dapat dimuat.')
    }

    if (instancesResult.status === 'fulfilled') {
      jobInstances.value = instancesResult.value
    } else {
      jobInstances.value = []
      jobDetailWarnings.value.push('Instance terdeteksi tidak dapat dimuat.')
    }

    if (volumesResult.status === 'fulfilled') {
      jobVolumes.value = volumesResult.value
    } else {
      jobVolumes.value = []
      const error = normalizeApiError(volumesResult.reason)
      jobDetailWarnings.value.push(`Estimasi volume gagal dimuat. ${error.message}${error.status === 403 ? ' Periksa izin predict:read bersama administrator, lalu muat ulang detail.' : ''}`)
    }

    if (isUnfinishedJob(selectedJob.value.status)) {
      startPolling(cameraId, jobId, selectedJob.value.status)
    }
  } finally {
    if (isActive() && requestId === jobDetailRequestId) loadingJobDetail.value = false
  }
}

async function viewJobDetails(jobId: string) {
  await loadJobDetail(jobId, true)
  if (selectedJob.value?.id !== jobId || !isJobDetailOpen.value) return

  await router.replace({
    query: {
      ...route.query,
      camera: selectedCameraId.value,
      job: jobId,
    },
  })
}

function onJobDetailOpenChange(open: boolean) {
  isJobDetailOpen.value = open
  if (open) return
  jobDetailRequestId += 1
  loadingJobDetail.value = false
  if (typeof route.query.job !== 'string') return

  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (key !== 'job' && typeof value === 'string') query[key] = value
  }
  void router.replace({ query })
}

function formatOutputType(type: string) {
  const labels: Record<string, string> = {
    mask: 'Mask Segmentasi',
    overlay: 'Overlay Segmentasi',
    instances_json: 'Instance JSON',
    depth_raw_vis: 'Depth Raw Vis',
    depth_scaled_vis: 'Depth Scaled Vis',
    depth_masked: 'Depth Masked',
    height_map: 'Height Map',
    lifted_points_npz: 'Titik 3D (NPZ)',
    volume_heatmap: 'Heatmap Volume',
    volume_result_npz: 'Volume Result NPZ',
    bev_image: 'BEV Image',
    bev_mask_proyeksi: 'BEV Mask Proyeksi',
    bev_overlay: 'BEV Overlay',
  }
  return labels[type] || type
}

function getSourceTypeBadgeClass(type: string): string {
  const classes: Record<string, string> = {
    upload: 'badge-primary',
    rtsp_frame: 'badge-warning',
    latest_rtsp: 'badge-warning',
  }
  return classes[type] || 'badge-neutral'
}

function formatSourceType(type: string): string {
  const labels: Record<string, string> = {
    upload: 'Upload Gambar',
    rtsp_frame: 'Frame RTSP',
    latest_rtsp: 'Frame Terbaru RTSP',
  }
  return labels[type] || type
}

function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    pending: 'badge-warning',
    processing: 'bg-brand-light text-brand',
    done: 'badge-positive',
    failed: 'badge-negative',
  }
  return classes[status] || 'badge-neutral'
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Menunggu',
    processing: 'Memproses',
    done: 'Selesai',
    failed: 'Gagal',
  }
  return labels[status] || status
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const displayStatus = (job: PredictionJob) => job.status

onMounted(() => {
  if (hasApiKey.value) void initialize()
})

async function initialize() {
  await fetchCameras()
  if (!isActive() || !selectedCameraId.value) return

  await Promise.all([fetchPredictionJobs(1), checkPrerequisites()])
  if (!isActive()) return

  if (trackedJobId.value) startPolling(selectedCameraId.value, trackedJobId.value)

  const jobQuery = typeof route.query.job === 'string' ? route.query.job : ''
  if (jobQuery) {
    await loadJobDetail(jobQuery, true)
  }
}

function resetPredictionState() {
  prerequisiteRequestId += 1
  stopPolling()
  cameras.value = []
  predictionJobs.value = []
  selectedCameraId.value = ''
  selectedJob.value = null
  jobOutputs.value = []
  jobInstances.value = []
  jobVolumes.value = []
  jobDetailWarnings.value = []
  isJobDetailOpen.value = false
  prerequisites.value = null
  prerequisitesError.value = ''
  checkingPrerequisites.value = false
  jobsPage.value = 1
  jobsTotal.value = 0
  jobsTotalPages.value = 1
}

watch(() => apiStore.hasApiKey, (newVal) => {
  if (newVal) {
    void initialize()
  } else {
    resetPredictionState()
  }
})

watch(() => [route.query.camera, route.query.job, route.query.tracking], ([cameraId, jobId]) => {
  if (typeof cameraId === 'string' && cameraId !== selectedCameraId.value && cameras.value.some(camera => camera.id === cameraId)) {
    selectedCameraId.value = cameraId
    void fetchPredictionJobs(1)
    void checkPrerequisites()
  }
  if (!selectedCameraId.value) return
  if (trackedJobId.value) startPolling(selectedCameraId.value, trackedJobId.value)
  if (typeof jobId !== 'string' || !jobId) {
    if (isJobDetailOpen.value) {
      isJobDetailOpen.value = false
      jobDetailRequestId += 1
      loadingJobDetail.value = false
    }
    return
  }
  if (jobId === selectedJob.value?.id && isJobDetailOpen.value) return
  void loadJobDetail(jobId, true)
})
</script>
