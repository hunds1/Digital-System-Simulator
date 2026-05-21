import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../api/endpoints'

export const useHealthcheck = () =>
  useQuery({
    queryKey: ['healthcheck'],
    queryFn: endpoints.getHealthcheck,
    retry: 1,
    staleTime: 30_000,
  })
