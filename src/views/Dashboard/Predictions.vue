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
            {{ prerequisites.has_active_calibration ? 'Parameter intrinsik tersedia.' : 'Belum ada kalibrasi aktif.' }}
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
            {{ prerequisites.has_active_ground_model ? 'Referensi tanah aktif untuk mengangkat titik ke bidang tanah.' : 'Belum ada model ground aktif.' }}
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
            {{ prerequisites.has_active_depth_scale ? 'Kalibrasi kedalaman tersedia untuk estimasi volume metrik.' : 'Belum ada skala kedalaman aktif.' }}
          </p>
          <Badge :class="prerequisites.has_active_depth_scale ? 'badge-positive' : 'badge-negative'" class="mt-2">
            {{ prerequisites.has_active_depth_scale ? 'Tersedia' : 'Tidak tersedia' }}
          </Badge>
          <RouterLink v-if="!prerequisites.has_active_depth_scale" :to="{ path: '/dashboard/depth-scales', query: { camera: selectedCameraId } }" class="btn btn-ghost btn-sm mt-3 min-h-11 w-full justify-center">
            Kelola Skala Kedalaman
          </RouterLink>
        </div>
      </div>

      <div v-if="prerequisites && prerequisites.missing.length > 0" class="mt-4 rounded-lg border border-negative-border bg-negative-bg/50 p-3">
        <p class="text-sm font-medium text-negative">Komponen yang hilang: {{ prerequisites.missing.join(', ') }}</p>
      </div>
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
              <th scope="col">Sumber</th>
              <th scope="col">Model Segmen</th>
              <th scope="col">Status</th>
              <th scope="col">Dibuat</th>
              <th scope="col">Selesai</th>
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
                <td>
                  <Badge :class="getSourceTypeBadgeClass(job.source_type)">
                    {{ formatSourceType(job.source_type) }}
                  </Badge>
                </td>
                <td class="text-text-muted">{{ job.seg_model || 'default' }}</td>
                <td>
                  <Badge :class="getStatusBadgeClass(displayStatus(job))" class="flex items-center gap-1">
                    <span v-if="isPolling(job.camera_id, job.id)" class="animate-spin">
                      <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </span>
                    {{ formatStatus(displayStatus(job)) }}
                  </Badge>
                </td>
                <td class="text-text-muted">{{ formatDate(job.created_at) }}</td>
                <td class="text-text-muted">{{ job.completed_at ? formatDate(job.completed_at) : '-' }}</td>
                <td>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    :disabled="job.status === 'processing'"
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
            <div v-if="prerequisitesValue.missing.length > 0" class="mt-2 text-sm text-negative">
              <span class="font-medium">Kurang: </span>{{ prerequisitesValue.missing.join(', ') }}
            </div>
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
            <p class="font-medium text-text">Gagal menjalankan prediksi</p>
            <p class="text-sm text-text-muted">{{ submitError }}</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" :disabled="submitting" @click="isCreateModalOpen = false">Batal</Button>
            <Button type="submit" :disabled="submitting || !canSubmit" :aria-busy="submitting" variant="primary">
              {{ submitting ? 'Memproses...' : 'Jalankan Prediksi' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Job Detail Dialog -->
    <Dialog
      v-model:open="isJobDetailOpen"
      :show-close-button="!loadingJobDetail"
      :disabled="loadingJobDetail"
      content-class="max-w-5xl"
      @update:open="onJobDetailOpenChange"
    >
      <DialogHeader>
        <DialogTitle>Detail Job Prediksi</DialogTitle>
        <DialogDescription v-if="selectedJob">Job {{ selectedJob.id.substring(0, 8) }}… · {{ formatSourceType(selectedJob.source_type) }} · {{ formatStatus(selectedJob.status) }}</DialogDescription>
      </DialogHeader>

      <div v-if="loadingJobDetail" class="loading-state" role="status" style="height: 300px;">
        <div class="spinner" aria-hidden="true" />
        Memuat detail job...
      </div>

      <template v-else-if="selectedJob">
        <div v-if="jobDetailWarnings.length > 0" class="mb-4 rounded-lg border border-warning-border bg-warning-bg/50 p-3" role="status">
          <p class="text-sm font-medium text-warning">Sebagian detail tidak dapat dimuat</p>
          <ul class="mt-1 list-inside list-disc text-sm text-text-muted">
            <li v-for="warning in jobDetailWarnings" :key="warning">{{ warning }}</li>
          </ul>
        </div>

        <!-- Job Metadata -->
        <div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p class="text-sm text-text-muted">Job ID</p>
            <p class="font-mono text-sm text-text">{{ selectedJob.id }}</p>
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
            <p class="text-sm text-text-muted">Model Segmen</p>
            <p class="text-text">{{ selectedJob.seg_model || 'default' }}</p>
          </div>
          <div>
            <p class="text-sm text-text-muted">Confidence</p>
            <p class="text-text">{{ selectedJob.seg_conf }}</p>
          </div>
          <div>
            <p class="text-sm text-text-muted">Dibuat</p>
            <p class="text-text">{{ formatDate(selectedJob.created_at) }}</p>
          </div>
          <div v-if="selectedJob.completed_at">
            <p class="text-sm text-text-muted">Selesai</p>
            <p class="text-text">{{ formatDate(selectedJob.completed_at) }}</p>
          </div>
          <div v-if="selectedJob.error_msg">
            <p class="text-sm text-text-muted">Error</p>
            <p class="text-negative">{{ selectedJob.error_msg }}</p>
          </div>
        </div>

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
                  <td class="numeric tabular-nums">{{ (inst.confidence * 100).toFixed(1) }}%</td>
                  <td class="numeric tabular-nums">{{ inst.volume_m3?.toFixed(3) ?? '-' }}</td>
                  <td class="numeric tabular-nums">{{ inst.footprint_m2?.toFixed(3) ?? '-' }}</td>
                  <td class="numeric tabular-nums">{{ inst.height_mean_m?.toFixed(3) ?? '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Volume Table -->
        <div v-if="jobVolumes.length > 0" class="border-t border-sheet-border pt-6">
          <h3 class="text-sm font-medium text-text mb-4">Estimasi Volume</h3>
          <div class="table-container">
            <table class="table" aria-label="Estimasi volume">
              <thead>
                <tr>
                  <th scope="col">Metode</th>
                  <th scope="col" class="numeric">Volume (m³)</th>
                  <th scope="col" class="numeric">Volume (L)</th>
                  <th scope="col" class="numeric">Cell Size (m)</th>
                  <th scope="col" class="numeric">Grid Cells</th>
                  <th scope="col" class="numeric">Titik</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="vol in jobVolumes" :key="vol.id">
                  <td class="font-medium text-text">{{ volumeMethodLabel(vol.method) }}</td>
                  <td class="numeric tabular-nums">{{ vol.volume_m3.toFixed(3) }}</td>
                  <td class="numeric tabular-nums">{{ vol.volume_liter.toFixed(0) }}</td>
                  <td class="numeric tabular-nums">{{ vol.cell_m?.toFixed(3) ?? '-' }}</td>
                  <td class="numeric tabular-nums">{{ vol.n_cells ?? '-' }}</td>
                  <td class="numeric tabular-nums">{{ vol.n_points ?? '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="jobOutputs.length === 0 && jobInstances.length === 0 && jobVolumes.length === 0 && jobDetailWarnings.length === 0" class="empty-state border-t border-sheet-border py-8">
          <Brain class="empty-state-icon" aria-hidden="true" />
          <p class="empty-state-title">Belum ada output untuk job ini</p>
          <p class="empty-state-description">Job mungkin masih diproses atau gagal. Cek status job di atas.</p>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
  checkPredictionPrerequisites 
} from '@/services/predictions'
import { getLatestSnapshot, isSnapshotFresh } from '@/services/snapshots'
import { normalizeApiError } from '@/services/api'
import type { Camera, PredictionJob, PredictionOutput, DetectedInstance, VolumeEstimate, PredictionPrerequisites, SnapshotResponse } from '@/types'

// UI Components
import { Button, Input, Label, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui'
import AuthenticatedArtifact from '@/components/AuthenticatedArtifact.vue'

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

const { startPolling, isPolling, getPollingStatus, stopPolling } = useJobPolling(
  apiGetPredictionJob,
  async (updatedJob) => {
    if (!isActive()) return
    toast.success('Prediksi selesai', {
      description: `Job ${updatedJob.id.substring(0, 8)}… ${updatedJob.status === 'done' ? 'berhasil' : 'gagal'}`,
    })
    await fetchPredictionJobs(1)
    if (isJobDetailOpen.value && selectedJob.value?.id === updatedJob.id) {
      await loadJobDetail(updatedJob.id, false)
    }
  }
)

const hasApiKey = computed(() => apiStore.hasApiKey)
const selectedCamera = computed(() => cameras.value.find(c => c.id === selectedCameraId.value))

const prerequisitesValue = computed(() => prerequisites.value)

const prerequisitesModalClass = computed(() => {
  if (!prerequisites.value) return ''
  if (prerequisites.value.has_active_calibration && prerequisites.value.has_active_ground_model && prerequisites.value.has_active_depth_scale) {
    return 'border-positive-border bg-positive-bg/30'
  }
  return 'border-warning-border bg-warning-bg/30'
})

const canSubmit = computed(() => {
  if (!selectedCameraId.value || !prerequisites.value || prerequisitesError.value) return false

  const pre = prerequisites.value
  if (!pre.has_active_calibration || !pre.has_active_ground_model || !pre.has_active_depth_scale) {
    return false
  }

  if (predForm.value.source_type === 'upload') {
    return !!uploadedImage.value
  }

  // For RTSP sources, we need the camera to have RTSP configured and stream enabled
  const camera = selectedCamera.value
  if (!camera?.rtsp_configured || !camera?.stream_enabled) {
    return false
  }

  return true
})

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

  if (append) {
    loadingMoreJobs.value = true
  } else {
    loading.value = true
    loadError.value = ''
  }

  try {
    const response = await apiListPredictionJobs(cameraId, page)
    if (!isActive() || cameraId !== selectedCameraId.value) return

    const items = append ? [...predictionJobs.value, ...response.items] : response.items
    const uniqueJobs = new Map(items.map(job => [job.id, job]))
    predictionJobs.value = Array.from(uniqueJobs.values())
    jobsPage.value = response.page
    jobsTotal.value = response.total
    jobsTotalPages.value = response.total_pages

    for (const job of response.items) {
      if (job.status === 'pending' || job.status === 'processing') {
        startPolling(cameraId, job.id)
      }
    }
  } catch (error) {
    if (!isActive()) return
    if (append) {
      toast.error('Gagal memuat job berikutnya', { description: errorMessage(error) })
    } else {
      loadError.value = errorMessage(error)
      toast.error('Gagal memuat data prediksi')
    }
  } finally {
    if (isActive() && cameraId === selectedCameraId.value) {
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
    if (key !== 'job' && typeof value === 'string') query[key] = value
  }
  if (selectedCameraId.value) query.camera = selectedCameraId.value
  await router.replace({ query })

  await Promise.all([fetchPredictionJobs(1), checkPrerequisites()])
}

let prerequisiteRequestId = 0

async function checkPrerequisites() {
  if (!selectedCameraId.value) {
    prerequisites.value = null
    prerequisitesError.value = ''
    return
  }

  const requestId = ++prerequisiteRequestId
  const cameraId = selectedCameraId.value
  checkingPrerequisites.value = true
  prerequisitesError.value = ''

  try {
    const result = await checkPredictionPrerequisites(cameraId)
    if (!isActive() || requestId !== prerequisiteRequestId || cameraId !== selectedCameraId.value) return
    prerequisites.value = result
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

const openCreateModal = async () => {
  if (!selectedCameraId.value) return
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
  isCreateModalOpen.value = true
  await checkPrerequisites()
}

async function submitPrediction() {
  if (!selectedCameraId.value || submitting.value) return

  const pre = prerequisites.value
  if (!pre || prerequisitesError.value) {
    toast.error('Prasyarat belum dapat diverifikasi', {
      description: 'Periksa kembali kalibrasi, model ground, dan depth scale sebelum menjalankan prediksi.',
    })
    return
  }
  if (!pre.has_active_calibration) {
    toast.error('Tidak bisa menjalankan prediksi', {
      description: 'Kamera belum memiliki kalibrasi aktif. Buat dan aktifkan kalibrasi terlebih dahulu.',
    })
    return
  }
  if (!pre.has_active_ground_model) {
    toast.error('Tidak bisa menjalankan prediksi', {
      description: 'Kamera belum memiliki model ground aktif. Buat referensi tanah dan aktifkan terlebih dahulu.',
    })
    return
  }
  if (!pre.has_active_depth_scale) {
    toast.error('Tidak bisa menjalankan prediksi', {
      description: 'Kamera belum memiliki depth scale aktif. Hubungi operator backend untuk menyediakan depth scale.',
    })
    return
  }

  // For RTSP sources, verify camera has RTSP configured and stream enabled
  if (predForm.value.source_type !== 'upload') {
    const camera = selectedCamera.value
    if (!camera?.rtsp_configured) {
      toast.error('RTSP tidak dikonfigurasi', {
        description: 'Kamera belum memiliki URL RTSP. Atur di Manajemen Kamera.',
      })
      return
    }
    if (!camera?.stream_enabled) {
      toast.error('Stream tidak aktif', {
        description: 'Aktifkan stream kamera terlebih dahulu.',
      })
      return
    }

    // For latest_rtsp, verify there's a fresh snapshot
    if (predForm.value.source_type === 'latest_rtsp') {
      try {
        const snapshot = await getLatestSnapshot(selectedCameraId.value, { max_frame_age_sec: predForm.value.max_frame_age_sec })
        if (!isSnapshotFresh(snapshot, predForm.value.max_frame_age_sec)) {
          toast.error('Snapshot tidak segar', {
            description: `Snapshot terakhir lebih dari ${predForm.value.max_frame_age_sec} detik yang lalu. Ambil snapshot baru atau gunakan rtsp_frame.`,
          })
          return
        }
      } catch (error) {
        const err = normalizeApiError(error)
        if (err.code === 'snapshot_not_found' || err.code === 'snapshot_stale' || err.code === 'snapshot_requires_enabled_stream') {
          toast.error('Snapshot tidak tersedia', {
            description: err.message,
          })
          return
        }
        throw error
      }
    }
  }

  if (predForm.value.source_type === 'upload' && !uploadedImage.value) {
    toast.warning('Pilih gambar untuk diunggah')
    return
  }

  const segConf = Number(predForm.value.seg_conf)
  const cellSize = Number(predForm.value.volume_cell_m)
  const minPoints = Number(predForm.value.volume_min_pts_per_cell)
  const maxFrameAge = Number(predForm.value.max_frame_age_sec)
  if (!Number.isFinite(segConf) || !Number.isFinite(cellSize) || !Number.isFinite(minPoints) || !Number.isFinite(maxFrameAge)) {
    submitError.value = 'Isi confidence, cell size, minimal titik per sel, dan maksimal usia frame dengan angka yang valid.'
    return
  }

  submitting.value = true
  submitError.value = ''
  try {
    const payload: {
      source_type: 'upload' | 'rtsp_frame' | 'latest_rtsp'
      seg_conf: number
      volume_cell_m: number
      volume_min_pts_per_cell: number
      max_frame_age_sec: number
      return_outputs: string[]
      file?: File
      timestamp?: string
    } = {
      source_type: predForm.value.source_type,
      seg_conf: segConf,
      volume_cell_m: cellSize,
      volume_min_pts_per_cell: minPoints,
      max_frame_age_sec: maxFrameAge,
      return_outputs: predForm.value.return_outputs.length > 0 ? predForm.value.return_outputs : [],
    }

    // Only add file and timestamp for upload source
    if (predForm.value.source_type === 'upload' && uploadedImage.value) {
      payload.file = uploadedImage.value
      payload.timestamp = new Date().toISOString()
    }

    const result = await apiSubmitPrediction(selectedCameraId.value, payload)
    if (!isActive()) return

    toast.success('Prediksi berhasil dikirim', {
      description: `Job ID: ${result.job_id}`,
    })
    isCreateModalOpen.value = false
    uploadedImage.value = null
    await fetchPredictionJobs(1)
    startPolling(selectedCameraId.value, result.job_id)
  } catch (error: unknown) {
    if (!isActive()) return
    const err = normalizeApiError(error)
    submitError.value = err.message
    toast.error('Gagal menjalankan prediksi', {
      description: err.message,
    })
  } finally {
    submitting.value = false
  }
}

async function loadJobDetail(jobId: string, showLoading = true) {
  const cameraId = selectedCameraId.value
  if (!cameraId) return

  if (showLoading) {
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
    if (!isActive() || cameraId !== selectedCameraId.value) return

    if (jobResult.status === 'rejected') {
      toast.error('Gagal memuat detail job', { description: errorMessage(jobResult.reason) })
      return
    }

    selectedJob.value = jobResult.value

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
      jobDetailWarnings.value.push('Estimasi volume belum tersedia atau gagal dimuat.')
    }

    isJobDetailOpen.value = true
    if (jobResult.value.status === 'pending' || jobResult.value.status === 'processing') {
      startPolling(cameraId, jobId)
    }
  } finally {
    if (showLoading && isActive()) loadingJobDetail.value = false
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
  if (open || typeof route.query.job !== 'string') return

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

function volumeMethodLabel(method: string): string {
  if (method === 'grid') return 'Grid/Voxel'
  if (method === 'convex_hull') return 'Convex Hull'
  return method
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

const displayStatus = (job: PredictionJob) => {
  const pollingStatus = getPollingStatus(job.camera_id, job.id)
  return pollingStatus ?? job.status
}

onMounted(() => {
  if (hasApiKey.value) void initialize()
})

async function initialize() {
  await fetchCameras()
  if (!isActive() || !selectedCameraId.value) return

  await Promise.all([fetchPredictionJobs(1), checkPrerequisites()])
  if (!isActive()) return

  const jobQuery = typeof route.query.job === 'string' ? route.query.job : ''
  if (jobQuery) {
    await loadJobDetail(jobQuery, true)
  }
}

function resetPredictionState() {
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

watch(() => route.query.job, (value) => {
  if (typeof value !== 'string' || !value) return
  if (value === selectedJob.value?.id || loadingJobDetail.value) return
  void loadJobDetail(value, true)
})
</script>