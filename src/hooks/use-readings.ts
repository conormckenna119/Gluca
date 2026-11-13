import { useQuery } from "@tanstack/react-query";
import { useDemo } from "../store";
import { MockGlucoseProvider, CsvGlucoseProvider } from "../providers";
const mock = new MockGlucoseProvider();
export function useReadings() {
  const { state } = useDemo();
  return useQuery({
    queryKey: ["readings", state.imported],
    queryFn: () => {
      const provider = state.imported.length
        ? new CsvGlucoseProvider(state.imported)
        : mock;
      return provider.getReadings(0, Date.now() + 86400000);
    },
  });
}
