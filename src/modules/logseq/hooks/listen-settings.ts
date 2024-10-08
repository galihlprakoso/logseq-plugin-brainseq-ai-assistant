import { useEffect } from "react"
import useSettingsStore from "../stores/useSettingsStore"

const useListenSettings = () => {
  const {setSettings} = useSettingsStore()

  useEffect(() => {
    const unlisten = window.logseq.onSettingsChanged((newSettings) => {
      setSettings(newSettings)
    })

    return () => unlisten()
  }, [setSettings])
}

export default useListenSettings