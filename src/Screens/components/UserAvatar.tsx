import { View, Text, Image, StyleSheet } from 'react-native';
import React, { useState } from 'react';
// import { IMAGES } from '../../assets/Images';

const image = require('./profile_image.png');

type Props = {
  url?: string;
  containerViewStyles?: any;
  imageStyles?: any;
};

const UserAvatar = ({ url, containerViewStyles, imageStyles }: Props) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const img = (url || '').trim();
  const hasImage = img.length > 0;

  return (
    <View
      style={[
        {
          height: '100%',
          width: '100%',
        },
        { ...containerViewStyles },
      ]}
    >
      {/* Placeholder shown when no URL or while network image loads */}
      {(!hasImage || !isImageLoaded) && (
        <Image
          source={image}
          style={[
            styles.userImage,
            {
              ...imageStyles,
            },
          ]}
        />
      )}

      {/* Only render network image if we actually have a non-empty URL */}
      {hasImage && (
        <Image
          resizeMode="cover"
          source={{ uri: img }}
          style={[
            { ...styles.userImage, opacity: isImageLoaded ? 1 : 0 },
            { ...imageStyles },
          ]}
          onLoadEnd={() => setIsImageLoaded(true)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  userImage: {
    height: '100%',
    width: '100%',
    borderRadius: 100,
  },
});

export default UserAvatar;
