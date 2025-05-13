<script lang="ts">
  import Map from "$lib/components/Map.svelte";
  import TrackList from "$lib/components/TrackList.svelte";
  import type { Position, Track } from "$lib/types";
  import { formatDate } from "$lib/utils";
  import { onMount } from "svelte";

  let isRecording = false;
  let tracks: Track[] = [];
  let currentTrack: Track | null = null;
  let map: any;
  let watchId: number | null = null;
  let importedTracks: Track[] = [];
  let trackColors = [
    "#FF5733",
    "#33FF57",
    "#3357FF",
    "#F033FF",
    "#FF3366",
    "#33FFF5",
    "#FFF533",
    "#8B33FF",
    "#FF8B33",
    "#33FF8B",
  ];

  // 当前正在记录的位置列表
  let currentPositions: Position[] = [];

  onMount(() => {
    // 从localStorage加载保存的轨迹
    const savedTracks = localStorage.getItem("tracks");
    if (savedTracks) {
      tracks = JSON.parse(savedTracks);
    }
  });

  function startRecording() {
    if (!navigator.geolocation) {
      alert("您的浏览器不支持地理位置功能");
      return;
    }

    isRecording = true;
    currentPositions = [];

    const startTime = new Date();
    currentTrack = {
      id: Date.now().toString(),
      name: `轨迹 ${formatDate(startTime)}`,
      startTime: startTime.toISOString(),
      endTime: "",
      positions: [],
    };

    // 每分钟记录一次位置
    watchId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPosition: Position = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || 0,
            timestamp: new Date().toISOString(),
            direction: 0, // 初始方向为0，后面会计算
          };

          currentPositions = [...currentPositions, newPosition];

          // 计算方向 (如果有两个以上的点)
          if (currentPositions.length > 1) {
            const prevPos = currentPositions[currentPositions.length - 2];
            const currPos = currentPositions[currentPositions.length - 1];

            // 计算两点之间的方向角度
            const direction = calculateDirection(
              prevPos.latitude,
              prevPos.longitude,
              currPos.latitude,
              currPos.longitude,
            );

            newPosition.direction = direction;
            currentPositions[currentPositions.length - 1] = newPosition;
          }

          if (currentTrack) {
            currentTrack.positions = [...currentPositions];
          }

          // 更新地图显示
          if (map) {
            map.updateCurrentTrack(currentPositions);
          }
        },
        (error) => {
          console.error("获取位置信息失败:", error);
        },
        { enableHighAccuracy: true },
      );
    }, 10000); // 每分钟记录一次

    // 立即记录第一个点
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newPosition: Position = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude || 0,
          timestamp: new Date().toISOString(),
          direction: 0,
        };

        currentPositions = [newPosition];

        if (currentTrack) {
          currentTrack.positions = [newPosition];
        }

        // 更新地图显示
        if (map) {
          map.updateCurrentTrack(currentPositions);
        }
      },
      (error) => {
        console.error("获取位置信息失败:", error);
      },
      { enableHighAccuracy: true },
    );
  }

  function stopRecording() {
    if (watchId !== null) {
      clearInterval(watchId);
      watchId = null;
    }

    if (currentTrack && currentPositions.length > 0) {
      currentTrack.endTime = new Date().toISOString();
      currentTrack.positions = [...currentPositions];

      // 保存轨迹
      tracks = [...tracks, currentTrack];
      localStorage.setItem("tracks", JSON.stringify(tracks));
    }

    isRecording = false;
    currentTrack = null;
    currentPositions = [];
    importedTracks = [];
  }

  function viewTrack(track: Track) {
    if (isRecording) return;

    if (map) {
      map.showTrack(track, trackColors[0]);
    }
  }

  function importTrack(event: CustomEvent<Track>) {
    const track = event.detail;

    // 确保不重复导入
    if (!importedTracks.some((t) => t.id === track.id)) {
      importedTracks = [...importedTracks, track];

      // 为导入的轨迹分配一个颜色
      const colorIndex = (importedTracks.length - 1) % trackColors.length;

      if (map && track.positions.length > 0) {
        map.showImportedTrack(track, trackColors[colorIndex + 1]);
      }
    }
  }

  function handleMapInit(event: CustomEvent<any>) {
    map = event.detail;
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
    bearing = (bearing + 270) % 360;

    return bearing;
  }
</script>

<main class="h-dvh w-full flex flex-col bg-gray-100">
  {#if isRecording}
    <!-- 记录模式 -->
    <div class="p-4 bg-green-500 text-white flex justify-between items-center">
      <h1 class="text-xl font-bold">正在记录轨迹...</h1>
      <button
        class="px-4 py-2 bg-red-500 text-white rounded-md shadow-md hover:bg-red-600 focus:outline-none"
        on:click={stopRecording}
      >
        结束记录
      </button>
    </div>

    <div class="flex-1 w-full">
      <Map
        on:init={handleMapInit}
        {currentPositions}
        showCurrentPosition={true}
      />
    </div>

    <!-- 导入轨迹选项 -->
    {#if isRecording}
      <div class="p-4 bg-white shadow-md">
        <h2 class="text-lg font-semibold mb-2">导入轨迹</h2>
        <TrackList
          {tracks}
          on:viewTrack={importTrack}
          buttonText="导入"
          hiddenIds={importedTracks.map((t) => t.id)}
        />
      </div>
    {/if}
  {:else}
    <!-- 非记录模式 -->
    <div class="p-4 bg-blue-500 text-white">
      <h1 class="text-2xl font-bold">户外轨迹记录</h1>
    </div>

    <!-- 开始记录按钮 -->
    <div class="p-4 bg-white shadow-md">
      <button
        class="w-full p-4 bg-green-500 text-white text-xl rounded-md shadow-md hover:bg-green-600 focus:outline-none"
        on:click={startRecording}
      >
        开始记录轨迹
      </button>
    </div>

    <div class="flex-1 w-full">
      <Map
        on:init={handleMapInit}
        {currentPositions}
        showCurrentPosition={true}
      />
    </div>

    <!-- 轨迹列表 -->
    <div class="flex-1 overflow-y-auto">
      <div class="p-4 bg-white">
        <h2 class="text-xl font-semibold mb-4">已有轨迹</h2>
        {#if tracks.length === 0}
          <p class="text-gray-500">暂无保存的轨迹</p>
        {:else}
          <TrackList {tracks} on:viewTrack={(e) => viewTrack(e.detail)} />
        {/if}
      </div>
    </div>
  {/if}
</main>
