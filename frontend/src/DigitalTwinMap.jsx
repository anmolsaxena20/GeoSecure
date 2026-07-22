import React, { useEffect, useRef } from 'react'

// Extended list of nodes across India's energy network
export const DEFAULT_NODES = [
  { id: 1, name: 'Mumbai High Offshore', type: 'wellhead', coords: [19.418, 71.35], health: 88, capacity: '350,000 bbl/d', inventory: 0, maxInventory: 0, coverDays: 0, demand: 0 },
  { id: 2, name: 'Jamnagar Refinery', type: 'refinery', coords: [22.47, 69.8], health: 74, capacity: '540,000 bbl/d', inventory: 4200000, maxInventory: 6000000, coverDays: 0, demand: 0 },
  { id: 3, name: 'Kochi Storage Hub', type: 'terminal', coords: [9.931, 76.267], health: 91, capacity: '220,000 bbl/d', inventory: 1800000, maxInventory: 2500000, coverDays: 14, demand: 180000 },
  { id: 4, name: 'Haldia Refinery', type: 'refinery', coords: [22.066, 88.069], health: 82, capacity: '160,000 bbl/d', inventory: 1200000, maxInventory: 2000000, coverDays: 0, demand: 0 },
  { id: 5, name: 'Numaligarh Refinery', type: 'refinery', coords: [26.634, 93.728], health: 65, capacity: '60,000 bbl/d', inventory: 450000, maxInventory: 800000, coverDays: 0, demand: 0 },
  { id: 6, name: 'Vizag Terminal', type: 'terminal', coords: [17.686, 83.218], health: 95, capacity: '310,000 bbl/d', inventory: 2100000, maxInventory: 3000000, coverDays: 18, demand: 150000 },
  { id: 7, name: 'Chennai Terminal', type: 'terminal', coords: [13.082, 80.27], health: 78, capacity: '280,000 bbl/d', inventory: 1400000, maxInventory: 2200000, coverDays: 11, demand: 190000 },
  { id: 8, name: 'Paradeep Storage', type: 'terminal', coords: [20.27, 86.67], health: 90, capacity: '200,000 bbl/d', inventory: 1900000, maxInventory: 2400000, coverDays: 16, demand: 120000 },
]

export const DEFAULT_PIPELINES = [
  { id: 'p1', from: 1, to: 2, name: 'Mumbai–Jamnagar Offshore Trunkline', type: 'crude_pipeline', capacity: 350000, currentFlow: 310000, health: 100 },
  { id: 'p2', from: 1, to: 3, name: 'Mumbai–Kochi Crude Feed', type: 'crude_pipeline', capacity: 200000, currentFlow: 180000, health: 100 },
  { id: 'p3', from: 2, to: 6, name: 'Jamnagar–Vizag Trans-India Corridor', type: 'product_rail', capacity: 250000, currentFlow: 210000, health: 85 },
  { id: 'p4', from: 4, to: 5, name: 'Assam–Haldia Pipeline', type: 'crude_pipeline', capacity: 120000, currentFlow: 75000, health: 65 },
  { id: 'p5', from: 6, to: 7, name: 'Vizag–Chennai Coastal Feed', type: 'product_rail', capacity: 180000, currentFlow: 160000, health: 95 },
  { id: 'p6', from: 4, to: 8, name: 'Haldia–Paradeep Rail Spur', type: 'product_rail', capacity: 150000, currentFlow: 135000, health: 90 },
]

function isValidCoords(coords) {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    typeof coords[0] === 'number' &&
    !isNaN(coords[0]) &&
    typeof coords[1] === 'number' &&
    !isNaN(coords[1])
  )
}

export default function DigitalTwinMap({
  nodes = DEFAULT_NODES,
  pipelines = DEFAULT_PIPELINES,
  selectedNodeId,
  onSelectNode,
  nodeHealthMap = {},
  className = 'h-[550px]',
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersGroupRef = useRef(null)
  const pipelinesGroupRef = useRef(null)

  // Dynamically load Leaflet CSS if not present
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
  }, [])

  // Initialize map instance safely
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return

    const initLeafletMap = () => {
      const L = window.L
      if (!L || !mapContainerRef.current) return

      // Clean up previous container initialization if present
      if (mapContainerRef.current._leaflet_id) {
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.remove()
          } catch (e) {
            console.warn('Map cleanup error:', e)
          }
          mapInstanceRef.current = null
        }
        delete mapContainerRef.current._leaflet_id
      }

      try {
        const map = L.map(mapContainerRef.current, {
          center: [20.5937, 78.9629],
          zoom: 5,
          minZoom: 4,
          maxZoom: 9,
          zoomControl: true,
          attributionControl: false,
        })

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          subdomains: 'abcd',
        }).addTo(map)

        markersGroupRef.current = L.layerGroup().addTo(map)
        pipelinesGroupRef.current = L.layerGroup().addTo(map)

        mapInstanceRef.current = map
      } catch (err) {
        console.error('Error initializing Leaflet map:', err)
      }
    }

    if (window.L) {
      initLeafletMap()
    } else {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => initLeafletMap()
      document.head.appendChild(script)
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove()
        } catch (e) {}
        mapInstanceRef.current = null
      }
      if (mapContainerRef.current && mapContainerRef.current._leaflet_id) {
        delete mapContainerRef.current._leaflet_id
      }
    }
  }, [])

  // Render markers and pipelines whenever props update
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return
    const L = window.L

    const markersGroup = markersGroupRef.current
    const pipelinesGroup = pipelinesGroupRef.current

    if (!markersGroup || !pipelinesGroup) return

    markersGroup.clearLayers()
    pipelinesGroup.clearLayers()

    const activeNodes = Array.isArray(nodes) && nodes.length > 0 ? nodes : DEFAULT_NODES
    const activePipelines = Array.isArray(pipelines) && pipelines.length > 0 ? pipelines : DEFAULT_PIPELINES

    const nodeMap = {}
    activeNodes.forEach((n) => {
      const key = String(n.id)
      const currentHealth = nodeHealthMap[n.id] !== undefined ? nodeHealthMap[n.id] : (nodeHealthMap[key] !== undefined ? nodeHealthMap[key] : n.health)
      nodeMap[key] = {
        ...n,
        currentHealth: currentHealth !== undefined ? currentHealth : 100,
      }
    })

    // 1. Draw Pipelines with strict coordinate validation
    activePipelines.forEach((link) => {
      const fromNode = nodeMap[String(link.from)]
      const toNode = nodeMap[String(link.to)]

      if (fromNode && toNode && isValidCoords(fromNode.coords) && isValidCoords(toNode.coords)) {
        let strokeColor = 'rgba(79, 240, 215, 0.7)'
        let weight = 4

        if (link.type === 'crude_pipeline') {
          strokeColor = 'rgba(245, 158, 11, 0.75)'
          weight = 5
        } else if (link.type === 'product_rail') {
          strokeColor = 'rgba(139, 92, 246, 0.65)'
          weight = 3
        }

        const avgHealth = Math.min(fromNode.currentHealth, toNode.currentHealth)
        if (avgHealth < 50) {
          strokeColor = 'rgba(244, 63, 94, 0.7)'
        } else if (avgHealth < 80) {
          strokeColor = 'rgba(245, 158, 11, 0.7)'
        }

        try {
          const polyline = L.polyline([fromNode.coords, toNode.coords], {
            color: strokeColor,
            weight: weight,
            opacity: 0.85,
            dashArray: avgHealth >= 50 ? '6, 8' : '3, 6',
            lineJoin: 'round',
          })

          polyline.bindTooltip(
            `
            <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
              <strong style="color: #4ff0d7;">${link.name}</strong><br/>
              Type: ${(link.type || '').replace('_', ' ').toUpperCase()}<br/>
              Capacity: ${(link.capacity || 0).toLocaleString()} bbl/d<br/>
              Route Health: ${avgHealth}%
            </div>
          `,
            { sticky: true }
          )

          polyline.addTo(pipelinesGroup)
        } catch (e) {
          console.warn('Skipping line render due to error:', e)
        }
      }
    })

    // 2. Draw Node Markers
    activeNodes.forEach((node) => {
      if (!isValidCoords(node.coords)) return

      const key = String(node.id)
      const currentHealth = nodeMap[key]?.currentHealth ?? 100
      const isSelected = selectedNodeId === node.id || String(selectedNodeId) === key

      let colorClass = 'bg-[#4ff0d7] border-[#4ff0d7] shadow-[0_0_15px_rgba(79,240,215,0.6)]'
      if (currentHealth < 60) {
        colorClass = 'bg-[#f43f5e] border-[#f43f5e] shadow-[0_0_15px_rgba(244,63,94,0.7)] animate-pulse'
      } else if (currentHealth < 80) {
        colorClass = 'bg-[#f59e0b] border-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.6)]'
      }

      const selectedRing = isSelected ? 'ring-4 ring-[#4ff0d7] scale-125' : ''

      const iconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-4 h-4 rounded-full border-2 ${colorClass} ${selectedRing} transition-all duration-300"></div>
          <div class="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#07131a]/90 px-2 py-0.5 text-[10px] font-semibold text-[#e8f1f2] border border-white/10 shadow-md">
            ${node.name}
          </div>
        </div>
      `

      try {
        const customIcon = L.divIcon({
          className: 'custom-div-icon',
          html: iconHtml,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })

        const marker = L.marker(node.coords, { icon: customIcon })

        const tooltipContent = `
          <div style="font-family: sans-serif; font-size: 12px; color: #e8f1f2; background: #07131a; padding: 6px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
            <strong style="color: #4ff0d7;">${node.name}</strong> (${(node.type || '').toUpperCase()})<br/>
            Operational Health: <strong>${currentHealth}%</strong><br/>
            Capacity: ${node.capacity}<br/>
            <span style="font-size: 10px; color: #8fa3ad;">Click marker to select node</span>
          </div>
        `

        marker.bindTooltip(tooltipContent, { direction: 'top', offset: [0, -15] })

        marker.on('click', () => {
          if (onSelectNode) onSelectNode(node.id)
        })

        marker.addTo(markersGroup)
      } catch (e) {
        console.warn('Skipping marker render due to error:', e)
      }
    })
  }, [nodes, pipelines, selectedNodeId, nodeHealthMap, onSelectNode])

  return (
    <div className={`relative w-full overflow-hidden rounded-3xl border border-white/10 shadow-[inset_0_0_30px_rgba(0,0,0,0.5)] ${className}`}>
      <div ref={mapContainerRef} className="h-full w-full bg-[#05070a]" />
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-white/10 bg-[#07131a]/80 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.25em] text-[#4ff0d7]">
        Live Geospatial Layer
      </div>
    </div>
  )
}

