# Arsip Dokumen

Folder ini berisi dokumen rencana/desain yang **sudah selesai, sudah digantikan, atau ditunda**. Dokumen di sini bukan acuan operasional — disimpan hanya sebagai jejak keputusan (kenapa arsitektur sekarang dipilih seperti ini).

| Dokumen | Alasan diarsipkan | Acuan aktif pengganti |
|---|---|---|
| [`deploy-to-cloud-plan.md`](deploy-to-cloud-plan.md) | Rencana VPS native (nginx + php-fpm + MySQL manual), ditunda. Sebagian besar provisioning-nya kini digantikan Docker. | [`../deploy/docker.md`](../deploy/docker.md), [`../deploy/deploy.md`](../deploy/deploy.md) |
| [`demo-server-config-plan.md`](demo-server-config-plan.md) | Rencana topologi 1 laptop server + N client desktop. Bagian client config sudah diimplementasi dan dijelaskan di panduan desktop. | [`../desktop/desktop.md`](../desktop/desktop.md), [`../deploy/deploy.md`](../deploy/deploy.md) |
| [`CLI_SERVER_SPEC.md`](CLI_SERVER_SPEC.md) | Rencana repo CLI terpisah untuk menyatukan storage. Arah yang dipilih: Docker + volume (issue #37). | [`../deploy/docker.md`](../deploy/docker.md) |
| [`dev-page-plan.md`](dev-page-plan.md) | Rencana halaman dev versi 3D isometrik; yang dikirim versi 2D. Ringkasan implementasi ada di knowledge transfer. | [`../dev/knowledge_transfer.md`](../dev/knowledge_transfer.md) (§12), [`../dev/user-flow.md`](../dev/user-flow.md) (§11) |

**Diarsipkan:** 21 November 2026.

**Aturan:** kalau butuh mengubah keputusan arsitektur, tulis dokumen baru di folder aktif (`docs/deploy/`, `docs/desktop/`, `docs/dev/`). Jangan mengedit isi arsip, kecuali memperbaiki link.
