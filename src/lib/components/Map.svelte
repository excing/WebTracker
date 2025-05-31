<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import { dev } from "$app/environment";
  import type { Track, Position } from "../types";

  export let currentPositions: Position[] = [];
  export let showCurrentPosition = false;

  const dispatch = createEventDispatcher();
  let mapContainer: HTMLElement;
  let map: any;
  let mapLoaded = false;
  let markers: any[] = [];
  let paths: any[] = [];
  let currentLocationMarker: any = null;

  onMount(async () => {
    // 动态加载 Leaflet
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href =
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/leaflet.css";
      document.head.appendChild(link);
    }

    // 等待Leaflet CSS加载
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 动态加载Leaflet JS
    if (typeof L === "undefined") {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.3/leaflet.js";
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }
  });

  function initMap() {
    // 初始化地图
    map = L.map(mapContainer).setView([39.9042, 116.4074], 13); // 默认北京中心

    L.tileLayer(
      dev
        ? "https://huw.blendiv.com/api/tile?s={s}&x={x}&y={y}&z={z}"
        : "/api/tile?s={s}&x={x}&y={y}&z={z}",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    ).addTo(map);

    mapLoaded = true;

    // 如果有当前位置，移动地图到该位置
    if (showCurrentPosition && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          map.setView([latitude, longitude], 15);

          // 添加当前位置标记
          if (currentLocationMarker) {
            map.removeLayer(currentLocationMarker);
          }

          currentLocationMarker = L.marker([latitude, longitude], {
            icon: L.divIcon({
              className: "current-location",
              html: '<div class="ping"></div>',
              iconSize: [20, 20],
            }),
          }).addTo(map);
        },
        (error) => {
          console.error("获取位置信息失败:", error);
        },
      );
    }

    // 公开地图API供外部使用
    const mapAPI = {
      showTrack: (track: Track, color: string) => {
        clearMap();
        drawTrack(track, color);

        // 调整地图视图以显示整个轨迹
        if (track.positions.length > 0) {
          const bounds = getTrackBounds(track);
          map.fitBounds(bounds);
        }
      },

      showImportedTrack: (track: Track, color: string) => {
        drawTrack(track, color);

        // 调整地图视图以显示所有轨迹
        const allBounds = paths.map((path) => path.getBounds());
        if (allBounds.length > 0) {
          const combinedBounds = L.latLngBounds(
            allBounds[0].getSouthWest(),
            allBounds[0].getNorthEast(),
          );
          for (let i = 1; i < allBounds.length; i++) {
            combinedBounds.extend(allBounds[i]);
          }
          map.fitBounds(combinedBounds);
        }
      },

      updateCurrentTrack: (positions: Position[]) => {
        // 移除之前的当前轨迹
        clearCurrentTrack();

        // 绘制新的当前轨迹
        if (positions.length > 0) {
          const lastPos = positions[positions.length - 1];

          // 更新地图中心
          map.setView([lastPos.latitude, lastPos.longitude], 15);

          // 更新当前位置标记
          if (currentLocationMarker) {
            map.removeLayer(currentLocationMarker);
          }

          currentLocationMarker = L.marker(
            [lastPos.latitude, lastPos.longitude],
            {
              icon: L.divIcon({
                className: "current-location",
                html: '<div class="ping"></div>',
                iconSize: [20, 20],
              }),
            },
          ).addTo(map);

          // 绘制当前轨迹路径
          if (positions.length > 1) {
            const latLngs = positions.map((pos) => [
              pos.latitude,
              pos.longitude,
            ]);
            const currentPath = L.polyline(latLngs, {
              color: "#FF0000",
              weight: 3,
            }).addTo(map);
            paths.push(currentPath);

            // 添加方向箭头
            for (let i = 1; i < positions.length; i++) {
              const p1 = positions[i - 1];
              const p2 = positions[i];

              // 在两点之间的中间位置添加箭头
              const midLat = (p1.latitude + p2.latitude) / 2;
              const midLng = (p1.longitude + p2.longitude) / 2;

              const arrowMarker = L.marker([midLat, midLng], {
                icon: L.divIcon({
                  className: "direction-arrow",
                  html: `<div class="arrow" style="transform: rotate(${p2.direction}deg)">➤</div>`,
                  iconSize: [20, 20],
                }),
              }).addTo(map);

              markers.push(arrowMarker);
            }
          }
        }
      },
    };

    // 分发初始化事件，提供地图API
    dispatch("init", mapAPI);
  }

  function clearMap() {
    // 清除所有标记和路径
    markers.forEach((marker) => map.removeLayer(marker));
    paths.forEach((path) => map.removeLayer(path));
    markers = [];
    paths = [];
  }

  function clearCurrentTrack() {
    // 仅清除当前轨迹，保留导入的轨迹
    const importedPaths = paths.filter((path) => path.importedTrack);
    clearMap();
    paths = importedPaths;
    importedPaths.forEach((path) => map.addLayer(path));
  }

  function drawTrack(track: Track, color: string) {
    if (!mapLoaded || !track.positions || track.positions.length === 0) return;

    const latLngs = track.positions.map((pos) => [pos.latitude, pos.longitude]);

    // 创建路径
    const path = L.polyline(latLngs, { color, weight: 3 }).addTo(map);
    path.importedTrack = true; // 标记为导入的轨迹
    paths.push(path);

    // 添加起点和终点标记
    const startPos = track.positions[0];
    const endPos = track.positions[track.positions.length - 1];

    const startMarker = L.marker([startPos.latitude, startPos.longitude], {
      icon: L.divIcon({
        className: "track-point",
        html: '<div class="start-point">起</div>',
        iconSize: [24, 24],
      }),
    }).addTo(map);

    const endMarker = L.marker([endPos.latitude, endPos.longitude], {
      icon: L.divIcon({
        className: "track-point",
        html: '<div class="end-point">终</div>',
        iconSize: [24, 24],
      }),
    }).addTo(map);

    markers.push(startMarker, endMarker);

    // 添加方向箭头
    for (let i = 1; i < track.positions.length; i++) {
      const p1 = track.positions[i - 1];
      const p2 = track.positions[i];

      // 计算方向（如果不存在）
      let direction = p2.direction;
      if (direction === 0 || direction === undefined) {
        direction = calculateDirection(
          p1.latitude,
          p1.longitude,
          p2.latitude,
          p2.longitude,
        );
      }

      // 在两点之间的中间位置添加箭头
      const midLat = (p1.latitude + p2.latitude) / 2;
      const midLng = (p1.longitude + p2.longitude) / 2;

      const arrowMarker = L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: "direction-arrow",
          html: `<div class="arrow" style="transform: rotate(${direction}deg); color: ${color}">➤</div>`,
          iconSize: [20, 20],
        }),
      }).addTo(map);

      markers.push(arrowMarker);
    }
  }

  function getTrackBounds(track: Track) {
    const latLngs = track.positions.map((pos) =>
      L.latLng(pos.latitude, pos.longitude),
    );
    return L.latLngBounds(latLngs);
  }

  // 计算两个坐标点之间的方向（角度）
  function calculateDirection(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const toDeg = (value: number) => (value * 180) / Math.PI;

    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

    let bearing = toDeg(Math.atan2(y, x));

    // 转换为0-360度范围
    bearing = (bearing + 360) % 360;

    return bearing;
  }
</script>

<div class="h-full w-full" bind:this={mapContainer}></div>

<style>
  :global(.current-location) {
    background: transparent;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  :global(.ping) {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: blue;
    position: relative;
  }

  :global(.ping::after) {
    content: "";
    position: absolute;
    top: -8px;
    left: -8px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: rgba(0, 0, 255, 0.5);
    animation: ping 1.5s infinite;
  }

  :global(.track-point) {
    display: flex;
    justify-content: center;
    align-items: center;
    background: transparent;
  }

  :global(.start-point) {
    width: 24px;
    height: 24px;
    background-color: green;
    color: white;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
  }

  :global(.end-point) {
    width: 24px;
    height: 24px;
    background-color: red;
    color: white;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
  }

  :global(.direction-arrow) {
    background: transparent;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  :global(.arrow) {
    font-size: 16px;
    font-weight: bold;
  }

  @keyframes ping {
    0% {
      transform: scale(0.5);
      opacity: 0.8;
    }
    70% {
      transform: scale(1);
      opacity: 0;
    }
    100% {
      transform: scale(0.5);
      opacity: 0;
    }
  }
</style>
