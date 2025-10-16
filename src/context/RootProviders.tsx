import { MediasoupProvider } from './RtcProvider';
import CallProvider from './CallProvider';
import SocketProvider from '../socket-client/SocketProvider';
import { UserProvider } from './userProvider';
import { MainCallScreenOverlay } from '../Screens/MainCallScreen';
import { LocationProvider } from './LocationProvider';
// import { MainCallScreenOverlay } from '../screens/Call/MainCallScreen';

const RootProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <UserProvider>
      <SocketProvider>
        <LocationProvider>
          <MediasoupProvider>
            <CallProvider>
              {children}
              {/* <MainCallScreenOverlay /> */}
              <MainCallScreenOverlay />
            </CallProvider>
          </MediasoupProvider>
        </LocationProvider>
      </SocketProvider>
    </UserProvider>
  );
};

export default RootProviders;
