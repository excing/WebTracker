<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Track } from '../types';
  import { formatDuration, formatDate } from '../utils';
  
  export let tracks: Track[] = [];
  export let buttonText: string = "查看";
  export let hiddenIds: string[] = [];
  
  const dispatch = createEventDispatcher();
  
  function handleClick(track: Track) {
    dispatch('viewTrack', track);
  }
  
  function calculateDistance(positions: any[]): number {
    if (!positions || positions.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < positions.length; i++) {
      const p1 = positions[i - 1];
      const p2 = positions[i];
      totalDistance += haversineDistance(
        p1.latitude, p1.longitude,
        p2.latitude, p2.longitude
      );
    }
    
    return totalDistance;
  }
  
  // 计算两点之间的距离（单位：米）
  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // 地球半径（米）
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }
</script>

<div class="space-y-2">
  {#each tracks as track}
    {#if !hiddenIds.includes(track.id)}
      <div class="p-3 bg-white border rounded-md shadow-sm hover:shadow-md">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="font-medium">{track.name}</h3>
            <div class="text-sm text-gray-600">
              <div>日期: {formatDate(new Date(track.startTime))}</div>
              <div>时长: {formatDuration(new Date(track.startTime), new Date(track.endTime))}</div>
              <div>距离: {(calculateDistance(track.positions) / 1000).toFixed(2)} 公里</div>
              <div>点数: {track.positions.length} 个</div>
            </div>
          </div>
          <button 
            class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none"
            on:click={() => handleClick(track)}
          >
            {buttonText}
          </button>
        </div>
      </div>
    {/if}
  {/each}
</div>